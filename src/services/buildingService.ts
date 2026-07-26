import type { Building, Floor, GraphEdge, GraphNode } from '@/models/types';
import {
  defaultBuildingName,
  defaultFloorName,
  MIN_BUILDING,
  MIN_FLOOR,
} from '@/utils/constants';
import { createEdgeId, createNodeId } from '@/utils/id';
import { cloneNode } from '@/services/propertyService';

/**
 * Pure operations over buildings and the floors they own.
 *
 * Nothing here knows about the project document, the store, or the UI — the
 * project layer binds these to `project.buildings` and keeps the active
 * building / floor ids consistent. Graph mutations stay in `graphService`.
 *
 * Ordering is array order everywhere (user-defined, reorderable). Ids are
 * only ever used for lookup, never for sorting.
 */

// ── Cloning ────────────────────────────────────────────────────────────────

/** Deep-clone a floor, preserving any unknown/custom top-level fields. */
export function cloneFloor(floor: Floor): Floor {
  return {
    ...floor,
    nodes: floor.nodes.map((n) => cloneNode(n)),
    metadata: floor.metadata ? { ...floor.metadata } : undefined,
  };
}

/** Deep-clone the project edge list. */
export function cloneEdges(edges: GraphEdge[]): GraphEdge[] {
  return edges.map((e) => ({
    ...e,
    metadata: e.metadata ? { ...e.metadata } : undefined,
  }));
}

export function cloneFloors(floors: Floor[]): Floor[] {
  return floors.map((f) => cloneFloor(f));
}

/** Deep-clone a building, preserving any unknown/custom top-level fields. */
export function cloneBuilding(building: Building): Building {
  return {
    ...building,
    floors: cloneFloors(building.floors),
    metadata: building.metadata ? { ...building.metadata } : undefined,
  };
}

export function cloneBuildings(buildings: Building[]): Building[] {
  return buildings.map((b) => cloneBuilding(b));
}

// ── Id allocation ──────────────────────────────────────────────────────────

/**
 * Lowest free id at or above `min`, so ids freed by deletion get reused.
 * Always terminates: `used` cannot cover every id in [min, min + used.size].
 */
function lowestFreeId(used: Set<number>, min: number): number {
  let id = min;
  while (used.has(id)) {
    id += 1;
  }
  return id;
}

/** Next building id that is free across the whole project. */
export function nextBuildingId(buildings: Building[]): number {
  return lowestFreeId(new Set(buildings.map((b) => b.id)), MIN_BUILDING);
}

/**
 * Next floor id that is free across the whole project.
 * Floor ids stay project-unique so flat exports remain unambiguous.
 */
export function nextFloorId(buildings: Building[]): number {
  const used = new Set<number>();
  for (const building of buildings) {
    for (const floor of building.floors) {
      used.add(floor.id);
    }
  }
  return lowestFreeId(used, MIN_FLOOR);
}

// ── Lookup ─────────────────────────────────────────────────────────────────

export function findBuilding(
  buildings: Building[],
  buildingId: number
): Building | undefined {
  return buildings.find((b) => b.id === buildingId);
}

/** Locate a floor anywhere in the project, with its owning building. */
export function findFloorLocation(
  buildings: Building[],
  floorId: number
): { building: Building; floor: Floor } | undefined {
  for (const building of buildings) {
    const floor = building.floors.find((f) => f.id === floorId);
    if (floor) {
      return { building, floor };
    }
  }
  return undefined;
}

/** Every floor in the project, in building order then floor order. */
export function listAllFloors(
  buildings: Building[]
): { building: Building; floor: Floor }[] {
  const result: { building: Building; floor: Floor }[] = [];
  for (const building of buildings) {
    for (const floor of building.floors) {
      result.push({ building, floor });
    }
  }
  return result;
}

// ── Factories ──────────────────────────────────────────────────────────────

/** Create an empty floor with independent origin at (0,0). */
export function createFloor(id: number, name?: string): Floor {
  return {
    id,
    name: name ?? defaultFloorName(id),
    imageName: null,
    imageDataUrl: null,
    imageWidth: 0,
    imageHeight: 0,
    nodes: [],
  };
}

/** Create a building, optionally seeded with one empty floor. */
export function createBuilding(
  id: number,
  name?: string,
  options?: { firstFloorId?: number; description?: string }
): Building {
  const floors =
    options?.firstFloorId !== undefined
      ? [createFloor(options.firstFloorId, defaultFloorName(1))]
      : [];
  return {
    id,
    name: name ?? defaultBuildingName(id),
    description: options?.description,
    floors,
  };
}

// ── Floor operations (within one building) ─────────────────────────────────

/** Append a new floor. Named by its position inside this building. */
export function addFloorToBuilding(
  building: Building,
  floorId: number
): Building {
  const floor = createFloor(
    floorId,
    defaultFloorName(building.floors.length + 1)
  );
  return { ...building, floors: [...building.floors, floor] };
}

/** Remove a floor. Returns the building unchanged when the floor is absent. */
export function removeFloorFromBuilding(
  building: Building,
  floorId: number
): Building {
  const floors = building.floors.filter((f) => f.id !== floorId);
  if (floors.length === building.floors.length) {
    return building;
  }
  return { ...building, floors };
}

/** Apply a transform to one floor of a building. */
export function updateFloorInBuilding(
  building: Building,
  floorId: number,
  updater: (floor: Floor) => Floor
): Building {
  return {
    ...building,
    floors: building.floors.map((f) => (f.id === floorId ? updater(f) : f)),
  };
}

/** Move a floor to another position within its building (index clamped). */
export function reorderFloorInBuilding(
  building: Building,
  floorId: number,
  targetIndex: number
): Building {
  const floors = reorderById(building.floors, floorId, targetIndex);
  return floors === building.floors ? building : { ...building, floors };
}

// ── Building operations (within the project's building list) ───────────────

/** Apply a transform to one building of a list. */
export function updateBuilding(
  buildings: Building[],
  buildingId: number,
  updater: (building: Building) => Building
): Building[] {
  return buildings.map((b) => (b.id === buildingId ? updater(b) : b));
}

/** Move a building to another position in the list (index clamped). */
export function reorderBuilding(
  buildings: Building[],
  buildingId: number,
  targetIndex: number
): Building[] {
  return reorderById(buildings, buildingId, targetIndex);
}

/**
 * Deep-copy a building under fresh ids.
 *
 * Every node id is regenerated so the copy never collides with the original.
 * The returned `nodeIdMap` (original id → copy id) lets the project layer
 * duplicate the edges that belong to this building; edges are not stored on
 * floors, so they cannot be copied here.
 *
 * Custom node properties, metadata and unknown fields are carried over as-is.
 */
export function duplicateBuilding(
  source: Building,
  buildingId: number,
  allocateFloorId: () => number,
  name?: string
): { building: Building; nodeIdMap: Map<string, string> } {
  const nodeIdMap = new Map<string, string>();

  const floors = source.floors.map((floor) => {
    const nextFloorId = allocateFloorId();

    const nodes: GraphNode[] = floor.nodes.map((node) => {
      const nextId = createNodeId();
      nodeIdMap.set(node.id, nextId);
      return { ...cloneNode(node), id: nextId, floor: nextFloorId };
    });

    return {
      ...floor,
      id: nextFloorId,
      nodes,
      metadata: floor.metadata ? { ...floor.metadata } : undefined,
    };
  });

  return {
    building: {
      ...source,
      id: buildingId,
      name: name ?? `${source.name} (copy)`,
      floors,
      metadata: source.metadata ? { ...source.metadata } : undefined,
    },
    nodeIdMap,
  };
}

/**
 * Clone the edges that live wholly inside a duplicated building.
 *
 * Edges with only one endpoint in the building are skipped — where the copy
 * should attach is ambiguous, so leaving it to the user beats guessing.
 */
export function duplicateInternalEdges(
  edges: GraphEdge[],
  nodeIdMap: Map<string, string>
): GraphEdge[] {
  const copies: GraphEdge[] = [];
  for (const edge of edges) {
    const from = nodeIdMap.get(edge.from);
    const to = nodeIdMap.get(edge.to);
    if (!from || !to) continue;
    copies.push({
      ...edge,
      id: createEdgeId(),
      from,
      to,
      metadata: edge.metadata ? { ...edge.metadata } : undefined,
    });
  }
  return copies;
}

/** Collect every node id owned by a building. */
export function collectBuildingNodeIds(building: Building): Set<string> {
  const ids = new Set<string>();
  for (const floor of building.floors) {
    for (const node of floor.nodes) ids.add(node.id);
  }
  return ids;
}

// ── Shared helpers ─────────────────────────────────────────────────────────

/**
 * Move the entry with `id` to `targetIndex` (clamped to bounds).
 * Returns the original array reference when nothing moves.
 */
function reorderById<T extends { id: number }>(
  items: T[],
  id: number,
  targetIndex: number
): T[] {
  const fromIndex = items.findIndex((item) => item.id === id);
  if (fromIndex === -1) {
    return items;
  }

  const toIndex = Math.max(0, Math.min(items.length - 1, targetIndex));
  if (toIndex === fromIndex) {
    return items;
  }

  const next = [...items];
  const [moved] = next.splice(fromIndex, 1);
  next.splice(toIndex, 0, moved);
  return next;
}
