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
  cloneFloors,
  createBuilding,
  duplicateBuilding,
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
import { parseNodeProperties } from '@/services/propertyService';

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
    metadata: {},
  };
}

export function cloneProject(project: MapEditorProject): MapEditorProject {
  return {
    ...project,
    buildings: cloneBuildings(project.buildings),
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

  assertUniqueIds(buildings);

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
    metadata: (parseMetadata(source.metadata) as ProjectMetadata) ?? {},
  };

  return normalizeActive(project);
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

  return {
    ...source,
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
    edges: Array.isArray(source.edges) ? source.edges.map(parseGraphEdge) : [],
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
  return {
    ...source,
    id: String(source.id ?? ''),
    from: String(source.from ?? ''),
    to: String(source.to ?? ''),
    distance: Number(source.distance) || 0,
    edgeType: (source.edgeType as GraphEdge['edgeType']) || 'NORMAL',
    bidirectional: source.bidirectional !== false,
  } as GraphEdge;
}

/**
 * Building ids must be unique project-wide, and floor ids must be unique
 * across every building so the flat export stays unambiguous.
 */
function assertUniqueIds(buildings: Building[]): void {
  const buildingIds = new Set<number>();
  const floorIds = new Set<number>();

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
  const buildings = project.buildings.filter((b) => b.id !== buildingId);
  if (buildings.length === project.buildings.length) {
    throw new Error(`Building ${buildingId} not found.`);
  }
  return normalizeActive(touch({ ...project, buildings }));
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

  const copy = duplicateBuilding(
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

  return normalizeActive(
    touch({
      ...project,
      buildings: updateBuilding(project.buildings, location.building.id, (b) =>
        removeFloorFromBuilding(b, floorId)
      ),
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

function touch(project: MapEditorProject): MapEditorProject {
  return { ...project, updatedAt: new Date().toISOString() };
}
