import type {
  ExportEdge,
  ExportFloor,
  ExportGraph,
  ExportNode,
  MapEditorProject,
} from '@/models/types';

/**
 * Build the backend-facing graph JSON.
 * Coordinates remain in image pixel space (origin top-left).
 */
export function buildExportGraph(project: MapEditorProject): ExportGraph {
  const floors: ExportFloor[] = project.floors
    .slice()
    .sort((a, b) => a.id - b.id)
    .map((floor) => {
      const nodes: ExportNode[] = floor.nodes.map((n) => ({
        id: n.id,
        floor: floor.id,
        x: n.x,
        y: n.y,
        label: n.label,
        type: n.type,
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
