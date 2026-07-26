import type { Floor, MapEditorProject } from '@/models/types';
import { defaultFloorName, MAX_FLOORS, MIN_FLOOR, PROJECT_VERSION } from '@/utils/constants';

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
    nodes: f.nodes.map((n) => ({ ...n })),
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
    if (!Number.isFinite(id) || id < MIN_FLOOR || id > MAX_FLOORS) {
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
        ? floor.nodes.map((n) => ({
            id: String(n.id),
            floor: Number(n.floor) || id,
            x: Number(n.x) || 0,
            y: Number(n.y) || 0,
            label: String(n.label ?? ''),
            type: n.type || 'NORMAL',
          }))
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

/** Add next available floor (max 7). */
export function addFloorToProject(project: MapEditorProject): MapEditorProject {
  if (project.floors.length >= MAX_FLOORS) {
    throw new Error(`Maximum of ${MAX_FLOORS} floors allowed.`);
  }
  const used = new Set(project.floors.map((f) => f.id));
  let nextId = MIN_FLOOR;
  while (used.has(nextId) && nextId <= MAX_FLOORS) {
    nextId += 1;
  }
  if (nextId > MAX_FLOORS) {
    throw new Error(`Maximum of ${MAX_FLOORS} floors allowed.`);
  }
  return {
    ...project,
    floors: [...project.floors, createFloor(nextId)],
    activeFloorId: nextId,
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
