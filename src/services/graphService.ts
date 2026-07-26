import type {
  CustomPropertySchema,
  CustomPropertyType,
  EdgeType,
  Floor,
  GraphEdge,
  GraphNode,
  NodeType,
} from '@/models/types';
import { nodeDistance, roundCoord, roundDistance } from '@/utils/geometry';
import { createEdgeId, createNodeId } from '@/utils/id';
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

  // When position changes, recompute all incident edge distances.
  const moved = nodes.find((n) => n.id === nodeId);
  const positionChanged =
    patch.x !== undefined || patch.y !== undefined;

  if (!positionChanged || !moved) {
    return { ...floor, nodes };
  }

  const nodeMap = new Map(nodes.map((n) => [n.id, n]));
  const edges = floor.edges.map((edge) => {
    if (edge.from !== nodeId && edge.to !== nodeId) {
      return edge;
    }
    const from = nodeMap.get(edge.from);
    const to = nodeMap.get(edge.to);
    if (!from || !to) return edge;
    return {
      ...edge,
      distance: roundDistance(nodeDistance(from, to)),
    };
  });

  return { ...floor, nodes, edges };
}

/**
 * Validate a candidate node id on a floor.
 * Returns an error message, or `null` when the id is acceptable.
 */
export function validateNodeId(
  floor: Floor,
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
  const duplicate = floor.nodes.some((n) => n.id === id && n.id !== exclude);
  if (duplicate) {
    return `Node ID "${id}" is already in use on this floor.`;
  }
  return null;
}

/** Count edges that reference a node as from or to. */
export function countNodeEdgeReferences(floor: Floor, nodeId: string): number {
  return floor.edges.reduce((count, edge) => {
    if (edge.from === nodeId || edge.to === nodeId) {
      return count + 1;
    }
    return count;
  }, 0);
}

/**
 * Rename a node id and rewrite every edge that references it.
 * Throws if validation fails or the node does not exist.
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

  const node = floor.nodes.find((n) => n.id === oldId);
  if (!node) {
    throw new Error(`Node "${oldId}" not found.`);
  }

  const error = validateNodeId(floor, nextId, { excludeId: oldId });
  if (error) {
    throw new Error(error);
  }

  const nodes = floor.nodes.map((n) =>
    n.id === oldId ? { ...n, id: nextId } : n
  );

  const edges = floor.edges.map((edge) => {
    const from = edge.from === oldId ? nextId : edge.from;
    const to = edge.to === oldId ? nextId : edge.to;
    if (from === edge.from && to === edge.to) {
      return edge;
    }
    return { ...edge, from, to };
  });

  // Integrity: every rewritten edge endpoint must resolve.
  const idSet = new Set(nodes.map((n) => n.id));
  for (const edge of edges) {
    if (!idSet.has(edge.from) || !idSet.has(edge.to)) {
      throw new Error(
        'Rename aborted: edge reference integrity check failed.'
      );
    }
  }

  // Integrity: no duplicate node ids after rename.
  if (idSet.size !== nodes.length) {
    throw new Error('Rename aborted: duplicate node ids detected.');
  }

  return { ...floor, nodes, edges };
}

/** Move multiple nodes by delta; update all affected edge distances once. */
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

  const nodeMap = new Map(nodes.map((n) => [n.id, n]));
  const edges = floor.edges.map((edge) => {
    if (!idSet.has(edge.from) && !idSet.has(edge.to)) {
      return edge;
    }
    const from = nodeMap.get(edge.from);
    const to = nodeMap.get(edge.to);
    if (!from || !to) return edge;
    return {
      ...edge,
      distance: roundDistance(nodeDistance(from, to)),
    };
  });

  return { ...floor, nodes, edges };
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

export function deleteNodesFromFloor(floor: Floor, nodeIds: string[]): Floor {
  const idSet = new Set(nodeIds);
  return {
    ...floor,
    nodes: floor.nodes.filter((n) => !idSet.has(n.id)),
    edges: floor.edges.filter(
      (e) => !idSet.has(e.from) && !idSet.has(e.to)
    ),
  };
}

export interface CreateEdgeInput {
  from: string;
  to: string;
  edgeType?: EdgeType;
  bidirectional?: boolean;
}

export function createEdgeOnFloor(
  floor: Floor,
  input: CreateEdgeInput
): Floor {
  if (input.from === input.to) {
    throw new Error('Cannot create an edge from a node to itself.');
  }

  const fromNode = floor.nodes.find((n) => n.id === input.from);
  const toNode = floor.nodes.find((n) => n.id === input.to);
  if (!fromNode || !toNode) {
    throw new Error('Both nodes must exist on the same floor.');
  }

  // Prevent exact duplicate directed edges.
  const exists = floor.edges.some(
    (e) => e.from === input.from && e.to === input.to
  );
  if (exists) {
    throw new Error('Edge already exists between these nodes.');
  }

  // Infer edge type from node types when not provided.
  let edgeType: EdgeType = input.edgeType ?? 'NORMAL';
  if (!input.edgeType) {
    if (fromNode.type === 'ELEVATOR' && toNode.type === 'ELEVATOR') {
      edgeType = 'ELEVATOR';
    } else if (fromNode.type === 'STAIR' && toNode.type === 'STAIR') {
      edgeType = 'STAIR';
    }
  }

  const edge: GraphEdge = {
    id: createEdgeId(),
    from: input.from,
    to: input.to,
    distance: roundDistance(nodeDistance(fromNode, toNode)),
    edgeType,
    bidirectional: input.bidirectional !== false,
  };

  return {
    ...floor,
    edges: [...floor.edges, edge],
  };
}

export function updateEdgeOnFloor(
  floor: Floor,
  edgeId: string,
  patch: Partial<Pick<GraphEdge, 'edgeType' | 'bidirectional' | 'distance'>>
): Floor {
  return {
    ...floor,
    edges: floor.edges.map((e) => {
      if (e.id !== edgeId) return e;
      return {
        ...e,
        edgeType: patch.edgeType ?? e.edgeType,
        bidirectional:
          patch.bidirectional !== undefined
            ? patch.bidirectional
            : e.bidirectional,
        distance:
          patch.distance !== undefined
            ? roundDistance(patch.distance)
            : e.distance,
      };
    }),
  };
}

export function deleteEdgesFromFloor(floor: Floor, edgeIds: string[]): Floor {
  const idSet = new Set(edgeIds);
  return {
    ...floor,
    edges: floor.edges.filter((e) => !idSet.has(e.id)),
  };
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

/** Find edge near a world point (segment distance). */
export function findEdgeAt(
  floor: Floor,
  x: number,
  y: number,
  maxDist: number
): GraphEdge | null {
  const nodeMap = new Map(floor.nodes.map((n) => [n.id, n]));
  let best: GraphEdge | null = null;
  let bestDist = maxDist;

  for (const edge of floor.edges) {
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

/** Rebuild all edge distances from current node positions. */
export function recalculateAllDistances(floor: Floor): Floor {
  const nodeMap = new Map(floor.nodes.map((n) => [n.id, n]));
  return {
    ...floor,
    edges: floor.edges.map((edge) => {
      const from = nodeMap.get(edge.from);
      const to = nodeMap.get(edge.to);
      if (!from || !to) return edge;
      return {
        ...edge,
        distance: roundDistance(nodeDistance(from, to)),
      };
    }),
  };
}
