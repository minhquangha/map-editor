import type { Floor, GraphNode, MapEditorProject } from '@/models/types';
import { defaultFloorName, MIN_FLOOR, PROJECT_VERSION } from '@/utils/constants';
import {
  cloneNode,
  parseNodeProperties,
} from '@/services/propertyService';

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
    edges: [],
  };
}

/** Create a brand-new project with Floor 1. */
export function createEmptyProject(name = 'Untitled Project'): MapEditorProject {
  const now = new Date().toISOString();
  return {
    version: PROJECT_VERSION,
    name,
    createdAt: now,
    updatedAt: now,
    activeFloorId: 1,
    floors: [createFloor(1)],
    metadata: {},
  };
}

/** Deep-clone floors for history / immutability. */
export function cloneFloors(floors: Floor[]): Floor[] {
  return floors.map((f) => ({
    ...f,
    nodes: f.nodes.map((n) => cloneNode(n)),
    edges: f.edges.map((e) => ({ ...e })),
  }));
}

export function cloneProject(project: MapEditorProject): MapEditorProject {
  return {
    ...project,
    floors: cloneFloors(project.floors),
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

/** Parse and validate a .mapeditor document. */
export function parseProject(content: string): MapEditorProject {
  let raw: unknown;
  try {
    raw = JSON.parse(content);
  } catch {
    throw new Error('Invalid project file: not valid JSON.');
  }

  if (!raw || typeof raw !== 'object') {
    throw new Error('Invalid project file: root must be an object.');
  }

  const data = raw as Partial<MapEditorProject>;

  if (data.version !== 1) {
    throw new Error(`Unsupported project version: ${String(data.version)}`);
  }

  if (!Array.isArray(data.floors) || data.floors.length === 0) {
    throw new Error('Invalid project file: missing floors.');
  }

  const floors: Floor[] = data.floors.map((f, index) => {
    if (!f || typeof f !== 'object') {
      throw new Error(`Invalid floor at index ${index}.`);
    }
    const floor = f as Floor;
    const id = Number(floor.id);
    if (!Number.isFinite(id) || id < MIN_FLOOR) {
      throw new Error(`Invalid floor id: ${String(floor.id)}`);
    }
    return {
      id,
      name: floor.name || defaultFloorName(id),
      imageName: floor.imageName ?? null,
      imageDataUrl: floor.imageDataUrl ?? null,
      imageWidth: Number(floor.imageWidth) || 0,
      imageHeight: Number(floor.imageHeight) || 0,
      nodes: Array.isArray(floor.nodes)
        ? floor.nodes.map((n) => parseGraphNode(n, id))
        : [],
      edges: Array.isArray(floor.edges)
        ? floor.edges.map((e) => ({
            id: String(e.id),
            from: String(e.from),
            to: String(e.to),
            distance: Number(e.distance) || 0,
            edgeType: e.edgeType || 'NORMAL',
            bidirectional: e.bidirectional !== false,
          }))
        : [],
    };
  });

  const activeFloorId =
    floors.find((f) => f.id === data.activeFloorId)?.id ?? floors[0].id;

  return {
    version: 1,
    name: data.name || 'Untitled Project',
    createdAt: data.createdAt || new Date().toISOString(),
    updatedAt: data.updatedAt || new Date().toISOString(),
    activeFloorId,
    floors,
    metadata: data.metadata || {},
  };
}

/** Append a new floor. The floor count is unlimited. */
export function addFloorToProject(project: MapEditorProject): MapEditorProject {
  const used = new Set(project.floors.map((f) => f.id));
  // Lowest free id, so ids freed by deletion get reused. Always terminates:
  // `used` cannot cover every id in [MIN_FLOOR, MIN_FLOOR + used.size].
  let nextId = MIN_FLOOR;
  while (used.has(nextId)) {
    nextId += 1;
  }
  return {
    ...project,
    floors: [...project.floors, createFloor(nextId)],
    activeFloorId: nextId,
    updatedAt: new Date().toISOString(),
  };
}

/**
 * Move a floor to another position in the floor list.
 * List order is user-defined and is what the UI and export follow.
 * `targetIndex` is clamped to the list bounds.
 */
export function reorderFloorInProject(
  project: MapEditorProject,
  floorId: number,
  targetIndex: number
): MapEditorProject {
  const fromIndex = project.floors.findIndex((f) => f.id === floorId);
  if (fromIndex === -1) {
    throw new Error(`Floor ${floorId} not found.`);
  }

  const toIndex = Math.max(
    0,
    Math.min(project.floors.length - 1, targetIndex)
  );
  if (toIndex === fromIndex) {
    return project;
  }

  const floors = [...project.floors];
  const [moved] = floors.splice(fromIndex, 1);
  floors.splice(toIndex, 0, moved);

  return {
    ...project,
    floors,
    updatedAt: new Date().toISOString(),
  };
}

/** Remove a floor (at least one must remain). */
export function removeFloorFromProject(
  project: MapEditorProject,
  floorId: number
): MapEditorProject {
  if (project.floors.length <= 1) {
    throw new Error('At least one floor is required.');
  }
  const floors = project.floors.filter((f) => f.id !== floorId);
  if (floors.length === project.floors.length) {
    throw new Error(`Floor ${floorId} not found.`);
  }
  const activeFloorId =
    project.activeFloorId === floorId ? floors[0].id : project.activeFloorId;
  return {
    ...project,
    floors,
    activeFloorId,
    updatedAt: new Date().toISOString(),
  };
}

export function getActiveFloor(project: MapEditorProject): Floor {
  const floor = project.floors.find((f) => f.id === project.activeFloorId);
  if (!floor) {
    throw new Error('Active floor not found.');
  }
  return floor;
}

export function updateFloorInProject(
  project: MapEditorProject,
  floorId: number,
  updater: (floor: Floor) => Floor
): MapEditorProject {
  return {
    ...project,
    floors: project.floors.map((f) => (f.id === floorId ? updater(f) : f)),
    updatedAt: new Date().toISOString(),
  };
}

/** Normalize a raw node from disk into a GraphNode (supports legacy files). */
function parseGraphNode(raw: unknown, floorId: number): GraphNode {
  const n = (raw && typeof raw === 'object' ? raw : {}) as Partial<GraphNode> &
    Record<string, unknown>;

  const { properties, propertySchema } = parseNodeProperties(
    n.properties,
    n.propertySchema
  );

  return {
    id: String(n.id ?? ''),
    floor: Number(n.floor) || floorId,
    x: Number(n.x) || 0,
    y: Number(n.y) || 0,
    label: String(n.label ?? ''),
    type: (n.type as GraphNode['type']) || 'NORMAL',
    room_type: String(n.room_type ?? ''),
    properties,
    propertySchema,
  };
}
