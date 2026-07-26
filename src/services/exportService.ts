import type {
  Building,
  ExportBuilding,
  ExportEdge,
  ExportFloor,
  ExportGraph,
  ExportNode,
  Floor,
  GraphEdge,
  MapEditorProject,
} from '@/models/types';
import { buildNodeIndex, type NodeIndex } from '@/services/navigationService';
import { exportProperties } from '@/services/propertyService';

/**
 * Build the backend-facing graph JSON.
 *
 * Coordinates remain in image pixel space (origin top-left).
 * Custom node properties and building/floor/edge metadata are included for
 * backend consumption.
 *
 * Emitted in the project's own (user-defined) building and floor order.
 *
 * Three views of the same data, for compatibility:
 *  - `buildings`  — the hierarchy
 *  - `floors`     — every floor, flat (pre-buildings consumers)
 *  - `edges`      — every edge, the authoritative list; the per-floor `edges`
 *                   arrays carry only the same-floor subset, because a
 *                   cross-floor edge belongs to no single floor
 */
export function buildExportGraph(project: MapEditorProject): ExportGraph {
  const index = buildNodeIndex(project);

  const edges: ExportEdge[] = project.edges
    .map((edge) => buildExportEdge(edge, index))
    .filter((e): e is ExportEdge => e !== null);

  // Same-floor edges, grouped by the floor that owns both endpoints.
  const byFloor = new Map<number, ExportEdge[]>();
  for (const edge of edges) {
    if (edge.crossFloor) continue;
    const list = byFloor.get(edge.fromFloor);
    if (list) list.push(edge);
    else byFloor.set(edge.fromFloor, [edge]);
  }

  const buildings: ExportBuilding[] = project.buildings.map((building) => ({
    id: building.id,
    name: building.name,
    description: building.description,
    floors: building.floors.map((floor) =>
      buildExportFloor(building, floor, byFloor.get(floor.id) ?? [])
    ),
    metadata: building.metadata,
  }));

  return {
    buildings,
    floors: buildings.flatMap((b) => b.floors),
    edges,
  };
}

/** Returns null when an endpoint cannot be resolved (never in a valid project). */
function buildExportEdge(
  edge: GraphEdge,
  index: NodeIndex
): ExportEdge | null {
  const from = index.get(edge.from);
  const to = index.get(edge.to);
  if (!from || !to) return null;

  return {
    id: edge.id,
    from: edge.from,
    to: edge.to,
    fromBuilding: from.building.id,
    fromFloor: from.floor.id,
    toBuilding: to.building.id,
    toFloor: to.floor.id,
    distance: edge.distance,
    weight: edge.weight,
    edgeType: edge.edgeType,
    bidirectional: edge.bidirectional,
    crossFloor: from.floor.id !== to.floor.id,
    metadata: edge.metadata,
  };
}

function buildExportFloor(
  building: Building,
  floor: Floor,
  edges: ExportEdge[]
): ExportFloor {
  const nodes: ExportNode[] = floor.nodes.map((n) => ({
    id: n.id,
    building: building.id,
    floor: floor.id,
    x: n.x,
    y: n.y,
    label: n.label,
    type: n.type,
    room_type: n.room_type ?? '',
    properties: exportProperties(n),
  }));

  return {
    id: floor.id,
    building: building.id,
    image: floor.imageName || `floor${floor.id}.png`,
    nodes,
    edges,
    metadata: floor.metadata,
  };
}

export function serializeExportGraph(project: MapEditorProject): string {
  return JSON.stringify(buildExportGraph(project), null, 2);
}

/** Lightweight stats for status bar / export dialogs. */
export function getProjectStats(project: MapEditorProject): {
  buildings: number;
  floors: number;
  nodes: number;
  edges: number;
  crossFloorEdges: number;
} {
  let floors = 0;
  let nodes = 0;

  for (const building of project.buildings) {
    floors += building.floors.length;
    for (const floor of building.floors) {
      nodes += floor.nodes.length;
    }
  }

  const index = buildNodeIndex(project);
  let crossFloorEdges = 0;
  for (const edge of project.edges) {
    const from = index.get(edge.from);
    const to = index.get(edge.to);
    if (from && to && from.floor.id !== to.floor.id) crossFloorEdges += 1;
  }

  return {
    buildings: project.buildings.length,
    floors,
    nodes,
    edges: project.edges.length,
    crossFloorEdges,
  };
}
