import type {
  Building,
  Floor,
  GraphEdge,
  GraphNode,
  MapEditorProject,
  Metadata,
  ProjectMetadata,
} from '@/models/types';
import {
  DEFAULT_BUILDING_NAME,
  defaultBuildingName,
  defaultFloorName,
  MIN_BUILDING,
  MIN_FLOOR,
  MIN_SUPPORTED_PROJECT_VERSION,
  PROJECT_VERSION,
} from '@/utils/constants';
import {
  addFloorToBuilding,
  cloneBuildings,
  cloneEdges,
  cloneFloors,
  collectBuildingNodeIds,
  createBuilding,
  duplicateBuilding,
  duplicateInternalEdges,
  findBuilding,
  findFloorLocation,
  listAllFloors,
  nextBuildingId,
  nextFloorId,
  removeFloorFromBuilding,
  reorderBuilding,
  reorderFloorInBuilding,
  updateBuilding,
  updateFloorInBuilding,
} from '@/services/buildingService';
import {
  createEdge,
  deleteEdgesFromList,
  deleteNodesFromFloor,
  moveNodesOnFloor,
  pruneDanglingEdges,
  recalculateEdgeDistances,
  renameEdgeEndpoints,
  renameEdgeIdInList,
  renameNodeIdOnFloor,
  setEdgeEndpoints,
  updateEdgeInList,
  updateNodeOnFloor,
  validateNodeId,
  type CreateEdgeInput,
} from '@/services/graphService';
import {
  buildNodeIndex,
  collectNodeIds,
  createEndpointLocator,
  recalculateFloorEdgeDistances,
} from '@/services/navigationService';
import { parseNodeProperties } from '@/services/propertyService';
import { DEFAULT_EDGE_WEIGHT } from '@/utils/constants';

/**
 * Project document concerns: create, clone, serialize, parse/migrate, and the
 * project-level wrappers that bind `buildingService` operations to
 * `project.buildings` while keeping the active building / floor consistent.
 */

// Re-exported so existing importers keep working after the buildings upgrade.
export { cloneFloors };

// ── Creation & cloning ─────────────────────────────────────────────────────

/** Create a brand-new project with one building holding one floor. */
export function createEmptyProject(name = 'Untitled Project'): MapEditorProject {
  const now = new Date().toISOString();
  const building = createBuilding(MIN_BUILDING, DEFAULT_BUILDING_NAME, {
    firstFloorId: MIN_FLOOR,
  });
  return {
    version: PROJECT_VERSION,
    name,
    createdAt: now,
    updatedAt: now,
    activeBuildingId: building.id,
    activeFloorId: building.floors[0].id,
    buildings: [building],
    edges: [],
    metadata: {},
  };
}

export function cloneProject(project: MapEditorProject): MapEditorProject {
  return {
    ...project,
    buildings: cloneBuildings(project.buildings),
    edges: cloneEdges(project.edges),
    metadata: project.metadata ? { ...project.metadata } : {},
  };
}

/** Serialize project to .mapeditor JSON string. */
export function serializeProject(project: MapEditorProject): string {
  const payload: MapEditorProject = {
    ...project,
    updatedAt: new Date().toISOString(),
  };
  return JSON.stringify(payload, null, 2);
}

// ── Parsing & migration ────────────────────────────────────────────────────

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

/** Keep a metadata bag verbatim when present, otherwise omit the field. */
function parseMetadata(raw: unknown): Metadata | undefined {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return undefined;
  }
  return { ...(raw as Metadata) };
}

/**
 * Parse and validate a `.mapeditor` document.
 *
 * Accepts version 1 (floors directly on the project) and version 2
 * (buildings). Version 1 documents are migrated by moving every floor into a
 * single default building — no data is dropped.
 *
 * Unknown/custom fields on the project, buildings, floors, nodes and edges are
 * carried through untouched so integrations and the JSON editor can store
 * arbitrary data.
 */
export function parseProject(content: string): MapEditorProject {
  let raw: unknown;
  try {
    raw = JSON.parse(content);
  } catch {
    throw new Error('Invalid project file: not valid JSON.');
  }

  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    throw new Error('Invalid project file: root must be an object.');
  }

  const source = raw as Record<string, unknown>;
  const version = Number(source.version);

  if (
    !Number.isFinite(version) ||
    version < MIN_SUPPORTED_PROJECT_VERSION ||
    version > PROJECT_VERSION
  ) {
    throw new Error(`Unsupported project version: ${String(source.version)}`);
  }

  const buildings =
    version >= 2
      ? parseBuildings(source.buildings)
      : [migrateLegacyFloors(source.floors)];

  // Version 3 stores edges on the project. Versions 1 and 2 stored them per
  // floor; hoist those up so cross-floor edges become expressible.
  const rawEdges =
    version >= 3 ? source.edges : collectLegacyEdges(source, version);
  const edges = Array.isArray(rawEdges) ? rawEdges.map(parseGraphEdge) : [];

  assertGraphIntegrity(buildings, edges);

  // `floors` only exists on version 1 documents; its contents now live inside
  // the migrated building, so drop the stale duplicate.
  const { floors: _legacyFloors, ...rest } = source;

  const project: MapEditorProject = {
    ...(rest as Partial<MapEditorProject>),
    version: PROJECT_VERSION,
    name: typeof source.name === 'string' && source.name ? source.name : 'Untitled Project',
    createdAt:
      typeof source.createdAt === 'string' ? source.createdAt : new Date().toISOString(),
    updatedAt:
      typeof source.updatedAt === 'string' ? source.updatedAt : new Date().toISOString(),
    activeBuildingId: Number(source.activeBuildingId),
    activeFloorId: Number(source.activeFloorId),
    buildings,
    edges,
    metadata: (parseMetadata(source.metadata) as ProjectMetadata) ?? {},
  };

  return normalizeActive(project);
}

/** Pull per-floor `edges` arrays out of a version 1 or 2 document. */
function collectLegacyEdges(
  source: Record<string, unknown>,
  version: number
): unknown[] {
  const rawFloors: unknown[] =
    version >= 2
      ? (Array.isArray(source.buildings) ? source.buildings : []).flatMap((b) => {
          const building = asRecord(b);
          return Array.isArray(building.floors) ? building.floors : [];
        })
      : Array.isArray(source.floors)
        ? source.floors
        : [];

  return rawFloors.flatMap((f) => {
    const floor = asRecord(f);
    return Array.isArray(floor.edges) ? floor.edges : [];
  });
}

/** Wrap version-1 top-level floors into the default building. */
function migrateLegacyFloors(rawFloors: unknown): Building {
  if (!Array.isArray(rawFloors) || rawFloors.length === 0) {
    throw new Error('Invalid project file: missing floors.');
  }
  return {
    id: MIN_BUILDING,
    name: DEFAULT_BUILDING_NAME,
    floors: rawFloors.map((f, index) => parseFloor(f, index)),
  };
}

function parseBuildings(rawBuildings: unknown): Building[] {
  if (!Array.isArray(rawBuildings) || rawBuildings.length === 0) {
    throw new Error('Invalid project file: missing buildings.');
  }

  return rawBuildings.map((raw, index) => {
    const source = asRecord(raw);
    if (Object.keys(source).length === 0) {
      throw new Error(`Invalid building at index ${index}.`);
    }

    const id = Number(source.id);
    if (!Number.isFinite(id) || id < MIN_BUILDING) {
      throw new Error(`Invalid building id: ${String(source.id)}`);
    }

    if (!Array.isArray(source.floors) || source.floors.length === 0) {
      throw new Error(
        `Building "${String(source.name ?? id)}" must contain at least one floor.`
      );
    }

    return {
      ...source,
      id,
      name:
        typeof source.name === 'string' && source.name
          ? source.name
          : defaultBuildingName(index + 1),
      description:
        typeof source.description === 'string' ? source.description : undefined,
      floors: source.floors.map((f, floorIndex) => parseFloor(f, floorIndex)),
      metadata: parseMetadata(source.metadata),
    } as Building;
  });
}

function parseFloor(raw: unknown, index: number): Floor {
  const source = asRecord(raw);
  if (Object.keys(source).length === 0) {
    throw new Error(`Invalid floor at index ${index}.`);
  }

  const id = Number(source.id);
  if (!Number.isFinite(id) || id < MIN_FLOOR) {
    throw new Error(`Invalid floor id: ${String(source.id)}`);
  }

  // Legacy per-floor `edges` are hoisted to the project by the caller; drop
  // the key here so it does not survive as a stale duplicate.
  const { edges: _legacyEdges, ...rest } = source;

  return {
    ...rest,
    id,
    name:
      typeof source.name === 'string' && source.name
        ? source.name
        : defaultFloorName(index + 1),
    imageName: typeof source.imageName === 'string' ? source.imageName : null,
    imageDataUrl:
      typeof source.imageDataUrl === 'string' ? source.imageDataUrl : null,
    imageWidth: Number(source.imageWidth) || 0,
    imageHeight: Number(source.imageHeight) || 0,
    nodes: Array.isArray(source.nodes)
      ? source.nodes.map((n) => parseGraphNode(n, id))
      : [],
    metadata: parseMetadata(source.metadata),
  } as Floor;
}

/** Normalize a raw node from disk into a GraphNode (supports legacy files). */
function parseGraphNode(raw: unknown, floorId: number): GraphNode {
  const source = asRecord(raw);

  const { properties, propertySchema } = parseNodeProperties(
    source.properties,
    source.propertySchema
  );

  return {
    ...source,
    id: String(source.id ?? ''),
    floor: Number(source.floor) || floorId,
    x: Number(source.x) || 0,
    y: Number(source.y) || 0,
    label: String(source.label ?? ''),
    type: (source.type as GraphNode['type']) || 'NORMAL',
    room_type: String(source.room_type ?? ''),
    properties,
    propertySchema,
  } as GraphNode;
}

function parseGraphEdge(raw: unknown): GraphEdge {
  const source = asRecord(raw);

  // `weight` arrived in version 3. Older edges default to the standard cost
  // rather than inheriting their pixel distance, so routing stays predictable.
  const rawWeight = Number(source.weight);
  const weight = Number.isFinite(rawWeight) ? rawWeight : DEFAULT_EDGE_WEIGHT;

  return {
    ...source,
    id: String(source.id ?? ''),
    from: String(source.from ?? ''),
    to: String(source.to ?? ''),
    distance: Number(source.distance) || 0,
    weight,
    edgeType: (source.edgeType as GraphEdge['edgeType']) || 'NORMAL',
    bidirectional: source.bidirectional !== false,
    metadata: parseMetadata(source.metadata),
  } as GraphEdge;
}

/**
 * Structural invariants the rest of the app relies on:
 *
 * - building ids unique project-wide
 * - floor ids unique across every building, so the flat export stays clear
 * - node ids unique project-wide, because edges reference nodes by id alone
 * - edge ids unique, and both endpoints resolving to a real node
 */
function assertGraphIntegrity(buildings: Building[], edges: GraphEdge[]): void {
  const buildingIds = new Set<number>();
  const floorIds = new Set<number>();
  const nodeIds = new Set<string>();

  for (const building of buildings) {
    if (buildingIds.has(building.id)) {
      throw new Error(`Duplicate building id: ${building.id}`);
    }
    buildingIds.add(building.id);

    for (const floor of building.floors) {
      if (floorIds.has(floor.id)) {
        throw new Error(
          `Duplicate floor id ${floor.id} (floor ids must be unique across all buildings).`
        );
      }
      floorIds.add(floor.id);

      for (const node of floor.nodes) {
        if (!node.id) {
          throw new Error(`Floor ${floor.id} contains a node with no id.`);
        }
        if (nodeIds.has(node.id)) {
          throw new Error(
            `Duplicate node id "${node.id}" (node ids must be unique across the whole project).`
          );
        }
        nodeIds.add(node.id);
      }
    }
  }

  const edgeIds = new Set<string>();
  for (const edge of edges) {
    if (!edge.id) {
      throw new Error('Project contains an edge with no id.');
    }
    if (edgeIds.has(edge.id)) {
      throw new Error(`Duplicate edge id: ${edge.id}`);
    }
    edgeIds.add(edge.id);

    if (!nodeIds.has(edge.from)) {
      throw new Error(`Edge "${edge.id}" references unknown node "${edge.from}".`);
    }
    if (!nodeIds.has(edge.to)) {
      throw new Error(`Edge "${edge.id}" references unknown node "${edge.to}".`);
    }
  }
}

/**
 * Repair the active building / floor pointers so they always resolve.
 * These are view state, not user data — silently corrected rather than
 * rejected, so a hand-edited document still opens.
 */
export function normalizeActive(project: MapEditorProject): MapEditorProject {
  const building =
    findBuilding(project.buildings, project.activeBuildingId) ??
    project.buildings[0];

  const floor =
    building.floors.find((f) => f.id === project.activeFloorId) ??
    building.floors[0];

  if (
    building.id === project.activeBuildingId &&
    floor.id === project.activeFloorId
  ) {
    return project;
  }

  return { ...project, activeBuildingId: building.id, activeFloorId: floor.id };
}

// ── Active selectors ───────────────────────────────────────────────────────

export function getActiveBuilding(project: MapEditorProject): Building {
  const building = findBuilding(project.buildings, project.activeBuildingId);
  if (!building) {
    throw new Error('Active building not found.');
  }
  return building;
}

export function getActiveFloor(project: MapEditorProject): Floor {
  const floor = getActiveBuilding(project).floors.find(
    (f) => f.id === project.activeFloorId
  );
  if (!floor) {
    throw new Error('Active floor not found.');
  }
  return floor;
}

// ── Building operations (project level) ────────────────────────────────────

/** Append a new building seeded with one floor, and make it active. */
export function addBuildingToProject(
  project: MapEditorProject
): MapEditorProject {
  const building = createBuilding(
    nextBuildingId(project.buildings),
    defaultBuildingName(project.buildings.length + 1),
    { firstFloorId: nextFloorId(project.buildings) }
  );
  return touch({
    ...project,
    buildings: [...project.buildings, building],
    activeBuildingId: building.id,
    activeFloorId: building.floors[0].id,
  });
}

/** Remove a building. At least one must remain. */
export function removeBuildingFromProject(
  project: MapEditorProject,
  buildingId: number
): MapEditorProject {
  if (project.buildings.length <= 1) {
    throw new Error('At least one building is required.');
  }
  const target = findBuilding(project.buildings, buildingId);
  if (!target) {
    throw new Error(`Building ${buildingId} not found.`);
  }

  const buildings = project.buildings.filter((b) => b.id !== buildingId);

  // Edges reaching into the removed building — from anywhere — go with it.
  const removedNodeIds = collectBuildingNodeIds(target);
  const edges = project.edges.filter(
    (e) => !removedNodeIds.has(e.from) && !removedNodeIds.has(e.to)
  );

  return normalizeActive(touch({ ...project, buildings, edges }));
}

export function updateBuildingInProject(
  project: MapEditorProject,
  buildingId: number,
  updater: (building: Building) => Building
): MapEditorProject {
  return touch({
    ...project,
    buildings: updateBuilding(project.buildings, buildingId, updater),
  });
}

/** Move a building to another position in the list (index clamped). */
export function reorderBuildingInProject(
  project: MapEditorProject,
  buildingId: number,
  targetIndex: number
): MapEditorProject {
  const buildings = reorderBuilding(project.buildings, buildingId, targetIndex);
  return buildings === project.buildings
    ? project
    : touch({ ...project, buildings });
}

/** Deep-copy a building (fresh building/floor/node/edge ids) and activate it. */
export function duplicateBuildingInProject(
  project: MapEditorProject,
  buildingId: number
): MapEditorProject {
  const source = findBuilding(project.buildings, buildingId);
  if (!source) {
    throw new Error(`Building ${buildingId} not found.`);
  }

  // Reserve ids as they are handed out so the copy's own floors cannot
  // collide with each other or with anything already in the project.
  const usedFloorIds = new Set(
    listAllFloors(project.buildings).map(({ floor }) => floor.id)
  );
  const allocateFloorId = () => {
    let id = MIN_FLOOR;
    while (usedFloorIds.has(id)) {
      id += 1;
    }
    usedFloorIds.add(id);
    return id;
  };

  const { building: copy, nodeIdMap } = duplicateBuilding(
    source,
    nextBuildingId(project.buildings),
    allocateFloorId
  );

  const index = project.buildings.findIndex((b) => b.id === buildingId);
  const buildings = [...project.buildings];
  buildings.splice(index + 1, 0, copy);

  return touch({
    ...project,
    buildings,
    // Edges wholly inside the source building are copied too; edges leaving it
    // are not, since where the copy should attach is ambiguous.
    edges: [...project.edges, ...duplicateInternalEdges(project.edges, nodeIdMap)],
    activeBuildingId: copy.id,
    activeFloorId: copy.floors[0].id,
  });
}

// ── Floor operations (project level) ───────────────────────────────────────

/** Append a floor to a building and make it active. */
export function addFloorToProject(
  project: MapEditorProject,
  buildingId: number
): MapEditorProject {
  const building = findBuilding(project.buildings, buildingId);
  if (!building) {
    throw new Error(`Building ${buildingId} not found.`);
  }

  const floorId = nextFloorId(project.buildings);
  return touch({
    ...project,
    buildings: updateBuilding(project.buildings, buildingId, (b) =>
      addFloorToBuilding(b, floorId)
    ),
    activeBuildingId: buildingId,
    activeFloorId: floorId,
  });
}

/** Remove a floor. Each building must keep at least one floor. */
export function removeFloorFromProject(
  project: MapEditorProject,
  floorId: number
): MapEditorProject {
  const location = findFloorLocation(project.buildings, floorId);
  if (!location) {
    throw new Error(`Floor ${floorId} not found.`);
  }
  if (location.building.floors.length <= 1) {
    throw new Error(
      `"${location.building.name}" must contain at least one floor.`
    );
  }

  // Edges reaching into the removed floor — from any floor — go with it.
  const removedNodeIds = new Set(location.floor.nodes.map((n) => n.id));
  const edges = project.edges.filter(
    (e) => !removedNodeIds.has(e.from) && !removedNodeIds.has(e.to)
  );

  return normalizeActive(
    touch({
      ...project,
      buildings: updateBuilding(project.buildings, location.building.id, (b) =>
        removeFloorFromBuilding(b, floorId)
      ),
      edges,
    })
  );
}

/** Apply a transform to one floor, wherever it lives. */
export function updateFloorInProject(
  project: MapEditorProject,
  floorId: number,
  updater: (floor: Floor) => Floor
): MapEditorProject {
  const location = findFloorLocation(project.buildings, floorId);
  if (!location) {
    return project;
  }
  return touch({
    ...project,
    buildings: updateBuilding(project.buildings, location.building.id, (b) =>
      updateFloorInBuilding(b, floorId, updater)
    ),
  });
}

/** Move a floor to another position within its own building (index clamped). */
export function reorderFloorInProject(
  project: MapEditorProject,
  floorId: number,
  targetIndex: number
): MapEditorProject {
  const location = findFloorLocation(project.buildings, floorId);
  if (!location) {
    throw new Error(`Floor ${floorId} not found.`);
  }
  return touch({
    ...project,
    buildings: updateBuilding(project.buildings, location.building.id, (b) =>
      reorderFloorInBuilding(b, floorId, targetIndex)
    ),
  });
}

/** Move the active pointers to a specific floor. */
export function setActiveFloorInProject(
  project: MapEditorProject,
  floorId: number
): MapEditorProject {
  const location = findFloorLocation(project.buildings, floorId);
  if (!location) {
    return project;
  }
  return {
    ...project,
    activeBuildingId: location.building.id,
    activeFloorId: location.floor.id,
  };
}

/** Move the active pointers to a building's first floor. */
export function setActiveBuildingInProject(
  project: MapEditorProject,
  buildingId: number
): MapEditorProject {
  const building = findBuilding(project.buildings, buildingId);
  if (!building || building.floors.length === 0) {
    return project;
  }
  const stillInside = building.floors.some(
    (f) => f.id === project.activeFloorId
  );
  return {
    ...project,
    activeBuildingId: buildingId,
    activeFloorId: stillInside ? project.activeFloorId : building.floors[0].id,
  };
}

// ── Graph operations (nodes on floors, edges on the project) ───────────────

/** Endpoint locator bound to the project's current node set. */
export function projectEndpointLocator(project: MapEditorProject) {
  return createEndpointLocator(buildNodeIndex(project));
}

/**
 * Apply a node patch and refresh the distances of edges touching it.
 * Only same-floor edges have a meaningful distance, so the refresh is scoped
 * to the node's own floor.
 */
export function updateNodeInProject(
  project: MapEditorProject,
  floorId: number,
  nodeId: string,
  patch: Parameters<typeof updateNodeOnFloor>[2]
): MapEditorProject {
  const next = updateFloorInProject(project, floorId, (f) =>
    updateNodeOnFloor(f, nodeId, patch)
  );

  const positionChanged = patch.x !== undefined || patch.y !== undefined;
  if (!positionChanged) {
    return next;
  }

  const floor = findFloorLocation(next.buildings, floorId)?.floor;
  return floor
    ? { ...next, edges: recalculateFloorEdgeDistances(next.edges, floor) }
    : next;
}

/** Move nodes on a floor and refresh the distances of edges inside it. */
export function moveNodesInProject(
  project: MapEditorProject,
  floorId: number,
  nodeIds: string[],
  dx: number,
  dy: number
): MapEditorProject {
  const next = updateFloorInProject(project, floorId, (f) =>
    moveNodesOnFloor(f, nodeIds, dx, dy)
  );
  if (next === project) {
    return project;
  }

  const floor = findFloorLocation(next.buildings, floorId)?.floor;
  return floor
    ? { ...next, edges: recalculateFloorEdgeDistances(next.edges, floor) }
    : next;
}

/** Delete nodes from a floor and drop every edge that referenced them. */
export function deleteNodesInProject(
  project: MapEditorProject,
  floorId: number,
  nodeIds: string[]
): MapEditorProject {
  const next = updateFloorInProject(project, floorId, (f) =>
    deleteNodesFromFloor(f, nodeIds)
  );
  const removed = new Set(nodeIds);
  return {
    ...next,
    edges: next.edges.filter(
      (e) => !removed.has(e.from) && !removed.has(e.to)
    ),
  };
}

/**
 * Rename a node id and rewrite every edge endpoint that referenced it.
 * Validates project-wide, since edges address nodes by id alone.
 */
export function renameNodeIdInProject(
  project: MapEditorProject,
  floorId: number,
  oldId: string,
  newId: string
): MapEditorProject {
  const nextId = newId.trim();
  if (nextId === oldId) {
    return project;
  }

  const error = validateNodeId(collectNodeIds(project), nextId, {
    excludeId: oldId,
  });
  if (error) {
    throw new Error(error);
  }

  const next = updateFloorInProject(project, floorId, (f) =>
    renameNodeIdOnFloor(f, oldId, nextId)
  );

  return { ...next, edges: renameEdgeEndpoints(next.edges, oldId, nextId) };
}

/** Create an edge between any two nodes, on the same floor or across floors. */
export function createEdgeInProject(
  project: MapEditorProject,
  input: CreateEdgeInput
): MapEditorProject {
  return touch({
    ...project,
    edges: createEdge(project.edges, input, projectEndpointLocator(project)),
  });
}

export function updateEdgeInProject(
  project: MapEditorProject,
  edgeId: string,
  patch: Parameters<typeof updateEdgeInList>[2]
): MapEditorProject {
  return touch({
    ...project,
    edges: updateEdgeInList(project.edges, edgeId, patch),
  });
}

export function renameEdgeIdInProject(
  project: MapEditorProject,
  oldId: string,
  newId: string
): MapEditorProject {
  const edges = renameEdgeIdInList(project.edges, oldId, newId);
  return edges === project.edges ? project : touch({ ...project, edges });
}

/** Repoint an existing edge at different endpoints. */
export function setEdgeEndpointsInProject(
  project: MapEditorProject,
  edgeId: string,
  fromId: string,
  toId: string
): MapEditorProject {
  return touch({
    ...project,
    edges: setEdgeEndpoints(
      project.edges,
      edgeId,
      fromId,
      toId,
      projectEndpointLocator(project)
    ),
  });
}

export function deleteEdgesInProject(
  project: MapEditorProject,
  edgeIds: string[]
): MapEditorProject {
  return touch({
    ...project,
    edges: deleteEdgesFromList(project.edges, edgeIds),
  });
}

/** Rebuild every same-floor edge distance from current node positions. */
export function recalculateAllDistancesInProject(
  project: MapEditorProject
): MapEditorProject {
  return {
    ...project,
    edges: recalculateEdgeDistances(
      project.edges,
      projectEndpointLocator(project)
    ),
  };
}

/** Drop edges whose endpoints no longer exist. Safety net after bulk edits. */
export function pruneProjectEdges(
  project: MapEditorProject
): MapEditorProject {
  const edges = pruneDanglingEdges(project.edges, collectNodeIds(project));
  return edges.length === project.edges.length ? project : { ...project, edges };
}

function touch(project: MapEditorProject): MapEditorProject {
  return { ...project, updatedAt: new Date().toISOString() };
}
