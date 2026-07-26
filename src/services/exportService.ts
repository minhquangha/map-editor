import type {
  Building,
  ExportBuilding,
  ExportEdge,
  ExportFloor,
  ExportGraph,
  ExportNode,
  Floor,
  MapEditorProject,
} from '@/models/types';
import { exportProperties } from '@/services/propertyService';

/**
 * Build the backend-facing graph JSON.
 *
 * Coordinates remain in image pixel space (origin top-left).
 * Custom node properties and floor/building metadata are included for
 * backend consumption.
 *
 * Emitted in the project's own (user-defined) building and floor order.
 * Alongside the `buildings` tree we also emit a flat `floors` array holding
 * the same floors — consumers written against the previous single-building
 * format keep working unchanged. Floor ids are unique project-wide, so the
 * flat view is never ambiguous.
 */
export function buildExportGraph(project: MapEditorProject): ExportGraph {
  const buildings: ExportBuilding[] = project.buildings.map((building) => ({
    id: building.id,
    name: building.name,
    description: building.description,
    floors: building.floors.map((floor) => buildExportFloor(building, floor)),
    metadata: building.metadata,
  }));

  return {
    buildings,
    floors: buildings.flatMap((b) => b.floors),
  };
}

function buildExportFloor(building: Building, floor: Floor): ExportFloor {
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

  const edges: ExportEdge[] = floor.edges.map((e) => ({
    from: e.from,
    to: e.to,
    distance: e.distance,
    edgeType: e.edgeType,
    bidirectional: e.bidirectional,
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
} {
  let floors = 0;
  let nodes = 0;
  let edges = 0;

  for (const building of project.buildings) {
    floors += building.floors.length;
    for (const floor of building.floors) {
      nodes += floor.nodes.length;
      edges += floor.edges.length;
    }
  }

  return { buildings: project.buildings.length, floors, nodes, edges };
}
