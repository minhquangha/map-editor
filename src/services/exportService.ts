import type {
  ExportEdge,
  ExportFloor,
  ExportGraph,
  ExportNode,
  MapEditorProject,
} from '@/models/types';
import { exportProperties } from '@/services/propertyService';

/**
 * Build the backend-facing graph JSON.
 * Coordinates remain in image pixel space (origin top-left).
 * Custom node properties are included for pathfinding backends.
 * Floors are emitted in the project's own (user-defined) order.
 */
export function buildExportGraph(project: MapEditorProject): ExportGraph {
  const floors: ExportFloor[] = project.floors
    .map((floor) => {
      const nodes: ExportNode[] = floor.nodes.map((n) => ({
        id: n.id,
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
        image: floor.imageName || `floor${floor.id}.png`,
        nodes,
        edges,
      };
    });

  return { floors };
}

export function serializeExportGraph(project: MapEditorProject): string {
  return JSON.stringify(buildExportGraph(project), null, 2);
}

/** Lightweight stats for status bar / export dialogs. */
export function getProjectStats(project: MapEditorProject): {
  floors: number;
  nodes: number;
  edges: number;
} {
  return {
    floors: project.floors.length,
    nodes: project.floors.reduce((sum, f) => sum + f.nodes.length, 0),
    edges: project.floors.reduce((sum, f) => sum + f.edges.length, 0),
  };
}
