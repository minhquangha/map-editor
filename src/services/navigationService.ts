import type {
  Building,
  Floor,
  GraphEdge,
  GraphNode,
  MapEditorProject,
  NodeConnection,
  NodeLocation,
} from '@/models/types';
import type { EdgeEndpointLocator } from '@/services/graphService';
import { nodeDistance, roundDistance } from '@/utils/geometry';

/**
 * Read side of the graph layer.
 *
 * The visual layer only ever renders one floor, so it asks here for the
 * same-floor slice of the graph. Everything cross-floor — connection lists,
 * node badges, endpoint lookup — is answered from the project-wide edge list
 * without the canvas needing to know it exists.
 */

export type NodeIndex = Map<string, NodeLocation>;

/** Index every node in the project by id, with its floor and building. */
export function buildNodeIndex(project: MapEditorProject): NodeIndex {
  const index: NodeIndex = new Map();
  for (const building of project.buildings) {
    for (const floor of building.floors) {
      for (const node of floor.nodes) {
        index.set(node.id, { node, floor, building });
      }
    }
  }
  return index;
}

/** Every node id in the project — used for uniqueness validation. */
export function collectNodeIds(project: MapEditorProject): Set<string> {
  const ids = new Set<string>();
  for (const building of project.buildings) {
    for (const floor of building.floors) {
      for (const node of floor.nodes) {
        ids.add(node.id);
      }
    }
  }
  return ids;
}

/** Adapt a node index into the locator `graphService` edge operations take. */
export function createEndpointLocator(index: NodeIndex): EdgeEndpointLocator {
  return (nodeId) => {
    const found = index.get(nodeId);
    return found ? { node: found.node, floorId: found.floor.id } : undefined;
  };
}

export function locateNode(
  index: NodeIndex,
  nodeId: string
): NodeLocation | undefined {
  return index.get(nodeId);
}

/** True when the edge's endpoints sit on different floors. */
export function isCrossFloorEdge(edge: GraphEdge, index: NodeIndex): boolean {
  const from = index.get(edge.from);
  const to = index.get(edge.to);
  if (!from || !to) return false;
  return from.floor.id !== to.floor.id;
}

// ── Visual layer queries ───────────────────────────────────────────────────

/**
 * Edges drawable on one floor: both endpoints must live on it.
 *
 * Cross-floor edges are deliberately excluded — the canvas must never draw a
 * line into a coordinate space it is not showing.
 */
export function getFloorEdges(
  edges: GraphEdge[],
  floor: Floor
): GraphEdge[] {
  const ids = new Set(floor.nodes.map((n) => n.id));
  return edges.filter((e) => ids.has(e.from) && ids.has(e.to));
}

/**
 * Per-node count of connections leaving this floor, for the canvas badge.
 * Only nodes with at least one such connection appear in the map.
 */
export function getCrossFloorCounts(
  edges: GraphEdge[],
  floor: Floor
): Map<string, number> {
  const onFloor = new Set(floor.nodes.map((n) => n.id));
  const counts = new Map<string, number>();

  const bump = (nodeId: string) => {
    counts.set(nodeId, (counts.get(nodeId) ?? 0) + 1);
  };

  for (const edge of edges) {
    const fromHere = onFloor.has(edge.from);
    const toHere = onFloor.has(edge.to);
    // Exactly one endpoint on this floor ⇒ the edge leaves the floor.
    if (fromHere === toHere) continue;
    bump(fromHere ? edge.from : edge.to);
  }

  return counts;
}

/**
 * Fast path for live dragging: refresh distances for edges wholly inside one
 * floor, without building a project-wide index. Edges touching other floors
 * are untouched (their distance is 0 by definition).
 */
export function recalculateFloorEdgeDistances(
  edges: GraphEdge[],
  floor: Floor
): GraphEdge[] {
  const nodes = new Map<string, GraphNode>();
  for (const node of floor.nodes) nodes.set(node.id, node);

  let changed = false;
  const next = edges.map((edge) => {
    const from = nodes.get(edge.from);
    const to = nodes.get(edge.to);
    if (!from || !to) return edge;
    const distance = roundDistance(nodeDistance(from, to));
    if (distance === edge.distance) return edge;
    changed = true;
    return { ...edge, distance };
  });

  return changed ? next : edges;
}

// ── Connection queries ─────────────────────────────────────────────────────

/** Count edges referencing a node as either endpoint. */
export function countNodeEdgeReferences(
  edges: GraphEdge[],
  nodeId: string
): number {
  let count = 0;
  for (const edge of edges) {
    if (edge.from === nodeId || edge.to === nodeId) count += 1;
  }
  return count;
}

/**
 * Every connection touching a node, resolved to its destination.
 *
 * Same-floor connections come first, then cross-floor, then cross-building —
 * so the Connections panel reads local-to-remote. Edges with an unresolvable
 * far endpoint are skipped rather than rendered broken.
 */
export function getNodeConnections(
  edges: GraphEdge[],
  nodeId: string,
  index: NodeIndex
): NodeConnection[] {
  const self = index.get(nodeId);
  if (!self) return [];

  const connections: NodeConnection[] = [];

  for (const edge of edges) {
    const outgoing = edge.from === nodeId;
    const incoming = edge.to === nodeId;
    if (!outgoing && !incoming) continue;

    const target = index.get(outgoing ? edge.to : edge.from);
    if (!target) continue;

    connections.push({
      edge,
      target,
      outgoing,
      crossFloor: target.floor.id !== self.floor.id,
      crossBuilding: target.building.id !== self.building.id,
    });
  }

  connections.sort((a, b) => {
    const rank = (c: NodeConnection) =>
      c.crossBuilding ? 2 : c.crossFloor ? 1 : 0;
    const byRank = rank(a) - rank(b);
    if (byRank !== 0) return byRank;
    return labelFor(a.target).localeCompare(labelFor(b.target));
  });

  return connections;
}

/** Display label for a node: its label, falling back to a short id. */
export function labelFor(location: NodeLocation): string {
  return location.node.label || location.node.id;
}

/**
 * Human-readable destination, e.g. `Floor 2` or `Annex · Floor 1`.
 * Building is only shown when it differs from the origin.
 */
export function describeDestination(
  connection: NodeConnection
): string {
  const { target, crossBuilding } = connection;
  return crossBuilding
    ? `${target.building.name} · ${target.floor.name}`
    : target.floor.name;
}

/** Buildings and floors as a flat pick-list, for endpoint selectors. */
export function listFloorOptions(
  project: MapEditorProject
): { building: Building; floor: Floor }[] {
  const options: { building: Building; floor: Floor }[] = [];
  for (const building of project.buildings) {
    for (const floor of building.floors) {
      options.push({ building, floor });
    }
  }
  return options;
}
