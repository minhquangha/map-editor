import type {
  CustomPropertySchema,
  CustomPropertyType,
  EdgeType,
  Floor,
  GraphEdge,
  GraphNode,
  Metadata,
  NodeType,
} from '@/models/types';
import { nodeDistance, roundCoord, roundDistance } from '@/utils/geometry';
import { createEdgeId, createNodeId } from '@/utils/id';
import { DEFAULT_EDGE_WEIGHT } from '@/utils/constants';
import {
  addProperty,
  cloneNode,
  cloneProperties,
  clonePropertySchema,
  deleteProperty,
  renameProperty,
  setPropertySchema,
  setPropertyValue,
} from '@/services/propertyService';

export interface CreateNodeInput {
  floor: number;
  x: number;
  y: number;
  label?: string;
  type?: NodeType;
  room_type?: string;
  properties?: Record<string, unknown>;
  propertySchema?: Record<string, CustomPropertySchema>;
}

export function createNode(input: CreateNodeInput): GraphNode {
  return {
    id: createNodeId(),
    floor: input.floor,
    x: roundCoord(input.x),
    y: roundCoord(input.y),
    label: input.label ?? '',
    type: input.type ?? 'NORMAL',
    room_type: input.room_type ?? '',
    properties: cloneProperties(input.properties),
    propertySchema: clonePropertySchema(input.propertySchema),
  };
}

export function addNodeToFloor(floor: Floor, input: CreateNodeInput): Floor {
  const node = createNode({ ...input, floor: floor.id });
  return {
    ...floor,
    nodes: [...floor.nodes, node],
  };
}

/**
 * Apply a patch to one node.
 *
 * Edge distances are *not* touched here — edges live on the project, so the
 * project layer recomputes them after a position change
 * (see `recalculateEdgeDistances`).
 */
export function updateNodeOnFloor(
  floor: Floor,
  nodeId: string,
  patch: Partial<Pick<GraphNode, 'x' | 'y' | 'label' | 'type' | 'room_type'>>
): Floor {
  const nodes = floor.nodes.map((n) => {
    if (n.id !== nodeId) return n;
    return {
      ...n,
      x: patch.x !== undefined ? roundCoord(patch.x) : n.x,
      y: patch.y !== undefined ? roundCoord(patch.y) : n.y,
      label: patch.label !== undefined ? patch.label : n.label,
      type: patch.type !== undefined ? patch.type : n.type,
      room_type:
        patch.room_type !== undefined ? patch.room_type : n.room_type,
    };
  });

  return { ...floor, nodes };
}

/**
 * Validate a candidate node id.
 *
 * Node ids must be unique across the whole project, not just within a floor:
 * edges live on the project and reference nodes by id alone, so a duplicate
 * id anywhere would make an endpoint ambiguous.
 *
 * Returns an error message, or `null` when the id is acceptable.
 */
export function validateNodeId(
  existingNodeIds: Iterable<string>,
  candidateId: string,
  options?: { excludeId?: string }
): string | null {
  const id = candidateId.trim();
  if (!id) {
    return 'Node ID cannot be empty.';
  }
  if (id.includes('\0')) {
    return 'Node ID contains invalid characters.';
  }
  const exclude = options?.excludeId;
  for (const existing of existingNodeIds) {
    if (existing === id && existing !== exclude) {
      return `Node ID "${id}" is already in use in this project.`;
    }
  }
  return null;
}

/**
 * Rename a node id on its floor. Edge endpoints are rewritten separately by
 * the project layer (`renameNodeIdInProject`), since edges are not floor-owned.
 * No-ops (returns the same floor reference) when ids are equal after trim.
 */
export function renameNodeIdOnFloor(
  floor: Floor,
  oldId: string,
  newId: string
): Floor {
  const nextId = newId.trim();
  if (nextId === oldId) {
    return floor;
  }

  if (!floor.nodes.some((n) => n.id === oldId)) {
    throw new Error(`Node "${oldId}" not found.`);
  }

  const nodes = floor.nodes.map((n) =>
    n.id === oldId ? { ...n, id: nextId } : n
  );

  // Integrity: no duplicate node ids on this floor after rename.
  if (new Set(nodes.map((n) => n.id)).size !== nodes.length) {
    throw new Error('Rename aborted: duplicate node ids detected.');
  }

  return { ...floor, nodes };
}

/** Rewrite every edge endpoint that referenced `oldId`. */
export function renameEdgeEndpoints(
  edges: GraphEdge[],
  oldId: string,
  newId: string
): GraphEdge[] {
  return edges.map((edge) => {
    const from = edge.from === oldId ? newId : edge.from;
    const to = edge.to === oldId ? newId : edge.to;
    if (from === edge.from && to === edge.to) {
      return edge;
    }
    return { ...edge, from, to };
  });
}

/**
 * Move multiple nodes by delta.
 * Incident edge distances are refreshed by the project layer afterwards.
 */
export function moveNodesOnFloor(
  floor: Floor,
  nodeIds: string[],
  dx: number,
  dy: number
): Floor {
  if (nodeIds.length === 0 || (dx === 0 && dy === 0)) {
    return floor;
  }

  const idSet = new Set(nodeIds);
  const nodes = floor.nodes.map((n) => {
    if (!idSet.has(n.id)) return n;
    return {
      ...n,
      x: roundCoord(n.x + dx),
      y: roundCoord(n.y + dy),
    };
  });

  return { ...floor, nodes };
}

/** Apply a pure node transform for custom property mutations. */
function mapNodeOnFloor(
  floor: Floor,
  nodeId: string,
  transform: (node: GraphNode) => GraphNode
): Floor {
  let found = false;
  const nodes = floor.nodes.map((n) => {
    if (n.id !== nodeId) return n;
    found = true;
    return transform(n);
  });
  if (!found) {
    throw new Error(`Node "${nodeId}" not found.`);
  }
  return { ...floor, nodes };
}

export function addNodePropertyOnFloor(
  floor: Floor,
  nodeId: string,
  key: string,
  type: CustomPropertyType,
  options?: string[]
): Floor {
  return mapNodeOnFloor(floor, nodeId, (n) => addProperty(n, key, type, options));
}

export function renameNodePropertyOnFloor(
  floor: Floor,
  nodeId: string,
  oldKey: string,
  newKey: string
): Floor {
  return mapNodeOnFloor(floor, nodeId, (n) => renameProperty(n, oldKey, newKey));
}

export function deleteNodePropertyOnFloor(
  floor: Floor,
  nodeId: string,
  key: string
): Floor {
  return mapNodeOnFloor(floor, nodeId, (n) => deleteProperty(n, key));
}

export function setNodePropertyValueOnFloor(
  floor: Floor,
  nodeId: string,
  key: string,
  value: unknown
): Floor {
  return mapNodeOnFloor(floor, nodeId, (n) => setPropertyValue(n, key, value));
}

export function setNodePropertySchemaOnFloor(
  floor: Floor,
  nodeId: string,
  key: string,
  schema: CustomPropertySchema
): Floor {
  return mapNodeOnFloor(floor, nodeId, (n) => setPropertySchema(n, key, schema));
}

/** Replace the entire custom properties bag (used for bulk / paste). */
export function replaceNodePropertiesOnFloor(
  floor: Floor,
  nodeId: string,
  properties: Record<string, unknown>,
  propertySchema: Record<string, CustomPropertySchema>
): Floor {
  return mapNodeOnFloor(floor, nodeId, (n) =>
    cloneNode({
      ...n,
      properties,
      propertySchema,
    })
  );
}

/**
 * Remove nodes from a floor.
 * Edges referencing them are pruned by the project layer
 * (`pruneDanglingEdges`), since an edge may originate on another floor.
 */
export function deleteNodesFromFloor(floor: Floor, nodeIds: string[]): Floor {
  const idSet = new Set(nodeIds);
  return {
    ...floor,
    nodes: floor.nodes.filter((n) => !idSet.has(n.id)),
  };
}

// ── Edges (project-scoped: endpoints may live on different floors) ─────────

/**
 * Resolves an edge endpoint to its node and owning floor.
 * Supplied by the project layer so this module stays project-agnostic.
 */
export type EdgeEndpointLocator = (
  nodeId: string
) => { node: GraphNode; floorId: number } | undefined;

export interface CreateEdgeInput {
  from: string;
  to: string;
  edgeType?: EdgeType;
  bidirectional?: boolean;
  weight?: number;
  metadata?: Metadata;
}

/**
 * Distance is only meaningful when both endpoints share a coordinate space.
 * Cross-floor edges get `0` and rely on `weight` for routing cost.
 */
function edgeDistanceFor(
  from: { node: GraphNode; floorId: number },
  to: { node: GraphNode; floorId: number }
): number {
  if (from.floorId !== to.floorId) {
    return 0;
  }
  return roundDistance(nodeDistance(from.node, to.node));
}

/** Append a new edge to the project edge list. */
export function createEdge(
  edges: GraphEdge[],
  input: CreateEdgeInput,
  locate: EdgeEndpointLocator
): GraphEdge[] {
  if (input.from === input.to) {
    throw new Error('Cannot create an edge from a node to itself.');
  }

  const from = locate(input.from);
  const to = locate(input.to);
  if (!from || !to) {
    throw new Error('Both nodes must exist in the project.');
  }

  // Prevent exact duplicate directed edges.
  if (edges.some((e) => e.from === input.from && e.to === input.to)) {
    throw new Error('Edge already exists between these nodes.');
  }

  return [...edges, { ...buildEdge(input, from, to), id: createEdgeId() }];
}

function buildEdge(
  input: CreateEdgeInput,
  from: { node: GraphNode; floorId: number },
  to: { node: GraphNode; floorId: number }
): Omit<GraphEdge, 'id'> {
  // Infer edge type from node types when not provided.
  let edgeType: EdgeType = input.edgeType ?? 'NORMAL';
  if (!input.edgeType) {
    if (from.node.type === 'ELEVATOR' && to.node.type === 'ELEVATOR') {
      edgeType = 'ELEVATOR';
    } else if (from.node.type === 'STAIR' && to.node.type === 'STAIR') {
      edgeType = 'STAIR';
    }
  }

  const weight =
    input.weight !== undefined && Number.isFinite(input.weight)
      ? input.weight
      : DEFAULT_EDGE_WEIGHT;

  return {
    from: input.from,
    to: input.to,
    distance: edgeDistanceFor(from, to),
    weight,
    edgeType,
    bidirectional: input.bidirectional !== false,
    metadata: input.metadata,
  };
}

export function updateEdgeInList(
  edges: GraphEdge[],
  edgeId: string,
  patch: Partial<
    Pick<
      GraphEdge,
      'edgeType' | 'bidirectional' | 'distance' | 'weight' | 'metadata'
    >
  >
): GraphEdge[] {
  return edges.map((e) => {
    if (e.id !== edgeId) return e;
    return {
      ...e,
      edgeType: patch.edgeType ?? e.edgeType,
      bidirectional:
        patch.bidirectional !== undefined ? patch.bidirectional : e.bidirectional,
      distance:
        patch.distance !== undefined ? roundDistance(patch.distance) : e.distance,
      weight:
        patch.weight !== undefined && Number.isFinite(patch.weight)
          ? patch.weight
          : e.weight,
      metadata: patch.metadata !== undefined ? patch.metadata : e.metadata,
    };
  });
}

/** Rename an edge id, rejecting blanks and collisions. */
export function renameEdgeIdInList(
  edges: GraphEdge[],
  oldId: string,
  newId: string
): GraphEdge[] {
  const nextId = newId.trim();
  if (nextId === oldId) {
    return edges;
  }
  if (!nextId) {
    throw new Error('Edge ID cannot be empty.');
  }
  if (!edges.some((e) => e.id === oldId)) {
    throw new Error(`Edge "${oldId}" not found.`);
  }
  if (edges.some((e) => e.id === nextId)) {
    throw new Error(`Edge ID "${nextId}" is already in use.`);
  }
  return edges.map((e) => (e.id === oldId ? { ...e, id: nextId } : e));
}

/** Repoint an edge at different endpoints, refreshing its distance. */
export function setEdgeEndpoints(
  edges: GraphEdge[],
  edgeId: string,
  fromId: string,
  toId: string,
  locate: EdgeEndpointLocator
): GraphEdge[] {
  if (fromId === toId) {
    throw new Error('Cannot create an edge from a node to itself.');
  }
  const from = locate(fromId);
  const to = locate(toId);
  if (!from || !to) {
    throw new Error('Both nodes must exist in the project.');
  }
  if (edges.some((e) => e.id !== edgeId && e.from === fromId && e.to === toId)) {
    throw new Error('Edge already exists between these nodes.');
  }

  return edges.map((e) =>
    e.id === edgeId
      ? { ...e, from: fromId, to: toId, distance: edgeDistanceFor(from, to) }
      : e
  );
}

export function deleteEdgesFromList(
  edges: GraphEdge[],
  edgeIds: string[]
): GraphEdge[] {
  const idSet = new Set(edgeIds);
  return edges.filter((e) => !idSet.has(e.id));
}

/** Drop every edge whose endpoints no longer resolve to a live node. */
export function pruneDanglingEdges(
  edges: GraphEdge[],
  liveNodeIds: Set<string>
): GraphEdge[] {
  return edges.filter(
    (e) => liveNodeIds.has(e.from) && liveNodeIds.has(e.to)
  );
}

export function findNodeAt(
  floor: Floor,
  x: number,
  y: number,
  hitRadius: number
): GraphNode | null {
  const r2 = hitRadius * hitRadius;
  // Reverse iterate so top-most (last drawn) wins.
  for (let i = floor.nodes.length - 1; i >= 0; i -= 1) {
    const n = floor.nodes[i];
    const dx = n.x - x;
    const dy = n.y - y;
    if (dx * dx + dy * dy <= r2) {
      return n;
    }
  }
  return null;
}

/**
 * Find an edge near a world point (segment distance).
 * Only same-floor edges are hit-testable — a cross-floor edge is never drawn.
 */
export function findEdgeAt(
  nodes: GraphNode[],
  edges: GraphEdge[],
  x: number,
  y: number,
  maxDist: number
): GraphEdge | null {
  const nodeMap = new Map(nodes.map((n) => [n.id, n]));
  let best: GraphEdge | null = null;
  let bestDist = maxDist;

  for (const edge of edges) {
    const a = nodeMap.get(edge.from);
    const b = nodeMap.get(edge.to);
    if (!a || !b) continue;
    const d = pointToSegmentDistance(x, y, a.x, a.y, b.x, b.y);
    if (d < bestDist) {
      bestDist = d;
      best = edge;
    }
  }
  return best;
}

function pointToSegmentDistance(
  px: number,
  py: number,
  x1: number,
  y1: number,
  x2: number,
  y2: number
): number {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const len2 = dx * dx + dy * dy;
  if (len2 === 0) {
    return Math.hypot(px - x1, py - y1);
  }
  let t = ((px - x1) * dx + (py - y1) * dy) / len2;
  t = Math.max(0, Math.min(1, t));
  const projX = x1 + t * dx;
  const projY = y1 + t * dy;
  return Math.hypot(px - projX, py - projY);
}

export function getNodesInRect(
  floor: Floor,
  x: number,
  y: number,
  w: number,
  h: number
): GraphNode[] {
  const minX = Math.min(x, x + w);
  const maxX = Math.max(x, x + w);
  const minY = Math.min(y, y + h);
  const maxY = Math.max(y, y + h);
  return floor.nodes.filter(
    (n) => n.x >= minX && n.x <= maxX && n.y >= minY && n.y <= maxY
  );
}

/**
 * Refresh `distance` on same-floor edges from current node positions.
 *
 * Pass `affectedNodeIds` to limit the work to edges touching moved nodes;
 * omit it to rebuild every distance. Cross-floor edges keep distance 0.
 */
export function recalculateEdgeDistances(
  edges: GraphEdge[],
  locate: EdgeEndpointLocator,
  affectedNodeIds?: Set<string>
): GraphEdge[] {
  return edges.map((edge) => {
    if (
      affectedNodeIds &&
      !affectedNodeIds.has(edge.from) &&
      !affectedNodeIds.has(edge.to)
    ) {
      return edge;
    }
    const from = locate(edge.from);
    const to = locate(edge.to);
    if (!from || !to) return edge;
    const distance = edgeDistanceFor(from, to);
    return distance === edge.distance ? edge : { ...edge, distance };
  });
}
