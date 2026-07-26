import { create } from 'zustand';
import type {
  Building,
  CustomPropertySchema,
  CustomPropertyType,
  EdgeType,
  EditorTool,
  Floor,
  HistorySnapshot,
  MapEditorProject,
  Metadata,
  NodeType,
  SelectionState,
  Viewport,
} from '@/models/types';
import {
  addBuildingToProject,
  addFloorToProject,
  createEmptyProject,
  duplicateBuildingInProject,
  getActiveBuilding,
  getActiveFloor,
  normalizeActive,
  parseProject,
  createEdgeInProject,
  deleteEdgesInProject,
  deleteNodesInProject,
  moveNodesInProject,
  removeBuildingFromProject,
  removeFloorFromProject,
  renameEdgeIdInProject,
  renameNodeIdInProject,
  reorderBuildingInProject,
  reorderFloorInProject,
  serializeProject,
  setActiveBuildingInProject,
  setActiveFloorInProject,
  setEdgeEndpointsInProject,
  updateBuildingInProject,
  updateEdgeInProject,
  updateFloorInProject,
  updateNodeInProject,
} from '@/services/projectService';
import {
  cloneBuildings,
  cloneEdges,
  findFloorLocation,
} from '@/services/buildingService';
import {
  addNodePropertyOnFloor,
  addNodeToFloor,
  deleteNodePropertyOnFloor,
  renameNodePropertyOnFloor,
  setNodePropertySchemaOnFloor,
  setNodePropertyValueOnFloor,
  validateNodeId,
} from '@/services/graphService';
import {
  buildNodeIndex,
  collectNodeIds,
  getFloorEdges,
} from '@/services/navigationService';
import {
  canRedo,
  canUndo,
  createEmptyHistory,
  createSnapshot,
  pushHistory,
  redo as historyRedo,
  undo as historyUndo,
  type HistoryState,
} from '@/services/historyService';
import {
  exportGraphJson,
  openFloorImage,
  openProjectFile,
  saveProjectAs,
  saveProjectFile,
} from '@/services/fileService';
import { fitViewportToImage } from '@/utils/geometry';
import { NODE_HIT_RADIUS } from '@/utils/constants';

export interface EditorStatus {
  message: string;
  severity: 'info' | 'success' | 'warning' | 'error';
}

/** Editable edge fields. `distance` stays auto-maintained for same-floor edges. */
export type EdgePatch = Partial<{
  edgeType: EdgeType;
  bidirectional: boolean;
  distance: number;
  weight: number;
  metadata: Metadata;
}>;

interface EditorState {
  project: MapEditorProject;
  projectPath: string | null;
  isDirty: boolean;
  tool: EditorTool;
  defaultNodeType: NodeType;
  selection: SelectionState;
  viewport: Viewport;
  stageSize: { width: number; height: number };
  history: HistoryState;
  /**
   * First node id when creating an edge (click A then B).
   * Survives floor and building switches so cross-floor edges can be drawn.
   */
  edgeDraftFromId: string | null;
  /**
   * Endpoints chosen but not yet committed — the Edge Properties dialog is
   * open. Nothing is written to the graph until it is confirmed.
   */
  pendingEdge: { fromId: string; toId: string } | null;
  status: EditorStatus | null;
  showNodeLabels: boolean;
  showDistances: boolean;
  isPanning: boolean;

  // ── Derived helpers ──────────────────────────────────────────────────────
  getActiveFloor: () => Floor;
  getActiveBuilding: () => Building;
  canUndo: () => boolean;
  canRedo: () => boolean;

  // ── UI / viewport ────────────────────────────────────────────────────────
  setTool: (tool: EditorTool) => void;
  setDefaultNodeType: (type: NodeType) => void;
  setViewport: (viewport: Viewport) => void;
  setStageSize: (width: number, height: number) => void;
  fitToScreen: () => void;
  zoomBy: (factor: number, screenX?: number, screenY?: number) => void;
  setStatus: (status: EditorStatus | null) => void;
  setShowNodeLabels: (value: boolean) => void;
  setShowDistances: (value: boolean) => void;
  setIsPanning: (value: boolean) => void;
  setEdgeDraftFromId: (id: string | null) => void;

  // ── Selection ────────────────────────────────────────────────────────────
  selectNodes: (nodeIds: string[], additive?: boolean) => void;
  selectEdges: (edgeIds: string[], additive?: boolean) => void;
  clearSelection: () => void;
  selectAll: () => void;

  // ── History ──────────────────────────────────────────────────────────────
  commitHistory: () => void;
  undo: () => void;
  redo: () => void;

  // ── Project ──────────────────────────────────────────────────────────────
  newProject: () => void;
  openProject: () => Promise<void>;
  saveProject: () => Promise<void>;
  saveProjectAs: () => Promise<void>;
  exportJson: () => Promise<void>;
  setProjectName: (name: string) => void;
  markClean: (path?: string | null) => void;
  /** Serialize the live project for the JSON editor. */
  getProjectJson: () => string;
  /**
   * Replace the whole project from edited JSON.
   * Throws with a readable message when the document is invalid — the current
   * project is left untouched in that case.
   */
  applyProjectJson: (json: string) => void;

  // ── Buildings ────────────────────────────────────────────────────────────
  setActiveBuilding: (buildingId: number) => void;
  addBuilding: () => void;
  removeBuilding: (buildingId: number) => void;
  renameBuilding: (buildingId: number, name: string) => void;
  setBuildingDescription: (buildingId: number, description: string) => void;
  duplicateBuilding: (buildingId: number) => void;
  /** Move a building within the list (`delta` of -1 / +1 = up / down). */
  moveBuilding: (buildingId: number, delta: number) => void;

  // ── Floors ───────────────────────────────────────────────────────────────
  setActiveFloor: (floorId: number) => void;
  /** Append a floor to a building (defaults to the active one). */
  addFloor: (buildingId?: number) => void;
  removeFloor: (floorId: number) => void;
  renameFloor: (floorId: number, name: string) => void;
  /** Move a floor within its own building (`delta` of -1 / +1 = up / down). */
  moveFloor: (floorId: number, delta: number) => void;
  openImageForActiveFloor: () => Promise<void>;

  // ── Graph mutations ──────────────────────────────────────────────────────
  addNodeAt: (worldX: number, worldY: number) => void;
  updateSelectedNode: (
    patch: Partial<{
      x: number;
      y: number;
      label: string;
      type: NodeType;
      room_type: string;
    }>
  ) => void;
  updateNode: (
    nodeId: string,
    patch: Partial<{
      x: number;
      y: number;
      label: string;
      type: NodeType;
      room_type: string;
    }>
  ) => void;
  /**
   * Rename a node id, rewrite edge from/to references, and keep selection in sync.
   * Pushes a single undo snapshot. Throws on validation failure.
   */
  renameNodeId: (oldId: string, newId: string) => void;
  moveSelectedNodes: (dx: number, dy: number) => void;
  /** Live move without history (during drag). */
  moveNodesLive: (nodeIds: string[], dx: number, dy: number) => void;
  deleteSelection: () => void;

  // ── Edges ────────────────────────────────────────────────────────────────
  /** Stage an edge between two nodes; opens the Edge Properties dialog. */
  connectEdge: (fromId: string, toId: string) => void;
  /** Commit the staged edge with the settings chosen in the dialog. */
  confirmPendingEdge: (settings: {
    edgeType: EdgeType;
    weight: number;
    bidirectional: boolean;
  }) => void;
  cancelPendingEdge: () => void;
  updateSelectedEdge: (patch: EdgePatch) => void;
  updateEdge: (edgeId: string, patch: EdgePatch) => void;
  /** Delete edges by id, independent of the current selection. */
  deleteEdges: (edgeIds: string[]) => void;
  /** Rename an edge id. Throws on blank or colliding ids. */
  renameEdgeId: (oldId: string, newId: string) => void;
  /** Repoint an edge at different endpoints (may cross floors). */
  setEdgeEndpoints: (edgeId: string, fromId: string, toId: string) => void;

  // ── Cross-floor navigation ───────────────────────────────────────────────
  /**
   * Jump to a node anywhere in the project: switches building and floor,
   * selects it and centres the viewport on it.
   */
  goToNode: (nodeId: string) => void;
  /** Jump to an edge and select it, switching to its source floor. */
  goToEdge: (edgeId: string) => void;

  // ── Custom node properties ───────────────────────────────────────────────
  addNodeProperty: (
    nodeId: string,
    key: string,
    type: CustomPropertyType,
    options?: string[]
  ) => void;
  renameNodeProperty: (nodeId: string, oldKey: string, newKey: string) => void;
  deleteNodeProperty: (nodeId: string, key: string) => void;
  setNodePropertyValue: (nodeId: string, key: string, value: unknown) => void;
  setNodePropertySchema: (
    nodeId: string,
    key: string,
    schema: CustomPropertySchema
  ) => void;
}

function emptySelection(): SelectionState {
  return { nodeIds: [], edgeIds: [] };
}

/** Restore floors/active pointers from an undo snapshot, keeping doc metadata. */
function restoreSnapshot(
  project: MapEditorProject,
  snapshot: HistorySnapshot
): MapEditorProject {
  return normalizeActive({
    ...project,
    buildings: cloneBuildings(snapshot.buildings),
    edges: cloneEdges(snapshot.edges),
    activeBuildingId: snapshot.activeBuildingId,
    activeFloorId: snapshot.activeFloorId,
  });
}

export const useEditorStore = create<EditorState>((set, get) => ({
  project: createEmptyProject(),
  projectPath: null,
  isDirty: false,
  tool: 'pointer',
  defaultNodeType: 'NORMAL',
  selection: emptySelection(),
  viewport: { x: 0, y: 0, scale: 1 },
  stageSize: { width: 800, height: 600 },
  history: createEmptyHistory(),
  edgeDraftFromId: null,
  pendingEdge: null,
  status: { message: 'Ready — open a floor plan image to begin.', severity: 'info' },
  showNodeLabels: true,
  showDistances: false,
  isPanning: false,

  getActiveFloor: () => getActiveFloor(get().project),
  getActiveBuilding: () => getActiveBuilding(get().project),
  canUndo: () => canUndo(get().history),
  canRedo: () => canRedo(get().history),

  setTool: (tool) =>
    set({
      tool,
      edgeDraftFromId: null,
    }),

  setDefaultNodeType: (type) => set({ defaultNodeType: type }),

  setViewport: (viewport) => set({ viewport }),

  setStageSize: (width, height) => set({ stageSize: { width, height } }),

  fitToScreen: () => {
    const floor = get().getActiveFloor();
    const { stageSize } = get();
    const vp = fitViewportToImage(
      stageSize.width,
      stageSize.height,
      floor.imageWidth || 2000,
      floor.imageHeight || 1500
    );
    set({ viewport: vp });
  },

  zoomBy: (factor, screenX, screenY) => {
    const { viewport, stageSize } = get();
    const cx = screenX ?? stageSize.width / 2;
    const cy = screenY ?? stageSize.height / 2;
    const newScale = viewport.scale * factor;
    const clamped = Math.min(8, Math.max(0.05, newScale));
    const worldX = (cx - viewport.x) / viewport.scale;
    const worldY = (cy - viewport.y) / viewport.scale;
    set({
      viewport: {
        scale: clamped,
        x: cx - worldX * clamped,
        y: cy - worldY * clamped,
      },
    });
  },

  setStatus: (status) => set({ status }),
  setShowNodeLabels: (value) => set({ showNodeLabels: value }),
  setShowDistances: (value) => set({ showDistances: value }),
  setIsPanning: (value) => set({ isPanning: value }),
  setEdgeDraftFromId: (id) => set({ edgeDraftFromId: id }),

  selectNodes: (nodeIds, additive = false) => {
    const prev = get().selection;
    set({
      selection: {
        nodeIds: additive
          ? Array.from(new Set([...prev.nodeIds, ...nodeIds]))
          : nodeIds,
        edgeIds: additive ? prev.edgeIds : [],
      },
    });
  },

  selectEdges: (edgeIds, additive = false) => {
    const prev = get().selection;
    set({
      selection: {
        edgeIds: additive
          ? Array.from(new Set([...prev.edgeIds, ...edgeIds]))
          : edgeIds,
        nodeIds: additive ? prev.nodeIds : [],
      },
    });
  },

  clearSelection: () => set({ selection: emptySelection(), edgeDraftFromId: null }),

  selectAll: () => {
    const { project } = get();
    const floor = getActiveFloor(project);
    set({
      selection: {
        nodeIds: floor.nodes.map((n) => n.id),
        // Only edges drawn on this floor — cross-floor edges are not visible
        // here, so selecting them would be invisible and surprising.
        edgeIds: getFloorEdges(project.edges, floor).map((e) => e.id),
      },
    });
  },

  commitHistory: () => {
    const { project, selection, history } = get();
    const snapshot = createSnapshot(
      project.buildings,
      project.edges,
      project.activeBuildingId,
      project.activeFloorId,
      selection
    );
    set({ history: pushHistory(history, snapshot) });
  },

  undo: () => {
    const { history, project, selection } = get();
    const current = createSnapshot(
      project.buildings,
      project.edges,
      project.activeBuildingId,
      project.activeFloorId,
      selection
    );
    const result = historyUndo(history, current);
    if (!result) return;
    set({
      history: result.history,
      project: restoreSnapshot(project, result.snapshot),
      selection: result.snapshot.selection,
      isDirty: true,
      edgeDraftFromId: null,
      status: { message: 'Undo', severity: 'info' },
    });
  },

  redo: () => {
    const { history, project, selection } = get();
    const current = createSnapshot(
      project.buildings,
      project.edges,
      project.activeBuildingId,
      project.activeFloorId,
      selection
    );
    const result = historyRedo(history, current);
    if (!result) return;
    set({
      history: result.history,
      project: restoreSnapshot(project, result.snapshot),
      selection: result.snapshot.selection,
      isDirty: true,
      edgeDraftFromId: null,
      status: { message: 'Redo', severity: 'info' },
    });
  },

  newProject: () => {
    set({
      project: createEmptyProject(),
      projectPath: null,
      isDirty: false,
      selection: emptySelection(),
      history: createEmptyHistory(),
      edgeDraftFromId: null,
      viewport: { x: 0, y: 0, scale: 1 },
      tool: 'pointer',
      status: { message: 'New project created.', severity: 'success' },
    });
  },

  openProject: async () => {
    try {
      const result = await openProjectFile();
      if (!result) return;
      set({
        project: result.project,
        projectPath: result.path,
        isDirty: false,
        selection: emptySelection(),
        history: createEmptyHistory(),
        edgeDraftFromId: null,
        status: {
          message: `Opened ${result.project.name}`,
          severity: 'success',
        },
      });
      // Fit after open
      setTimeout(() => get().fitToScreen(), 50);
    } catch (err) {
      set({
        status: {
          message: err instanceof Error ? err.message : 'Failed to open project',
          severity: 'error',
        },
      });
    }
  },

  saveProject: async () => {
    try {
      const { project, projectPath } = get();
      const path = await saveProjectFile(project, projectPath);
      if (!path) return;
      set({
        projectPath: path,
        isDirty: false,
        project: { ...project, updatedAt: new Date().toISOString() },
        status: { message: `Saved ${path}`, severity: 'success' },
      });
    } catch (err) {
      set({
        status: {
          message: err instanceof Error ? err.message : 'Save failed',
          severity: 'error',
        },
      });
    }
  },

  saveProjectAs: async () => {
    try {
      const { project } = get();
      const path = await saveProjectAs(project);
      if (!path) return;
      set({
        projectPath: path,
        isDirty: false,
        status: { message: `Saved as ${path}`, severity: 'success' },
      });
    } catch (err) {
      set({
        status: {
          message: err instanceof Error ? err.message : 'Save As failed',
          severity: 'error',
        },
      });
    }
  },

  exportJson: async () => {
    try {
      const path = await exportGraphJson(get().project);
      if (!path) return;
      set({
        status: { message: `Exported graph to ${path}`, severity: 'success' },
      });
    } catch (err) {
      set({
        status: {
          message: err instanceof Error ? err.message : 'Export failed',
          severity: 'error',
        },
      });
    }
  },

  setProjectName: (name) => {
    set((s) => ({
      project: { ...s.project, name },
      isDirty: true,
    }));
  },

  markClean: (path) =>
    set((s) => ({
      isDirty: false,
      projectPath: path !== undefined ? path : s.projectPath,
    })),

  getProjectJson: () => serializeProject(get().project),

  applyProjectJson: (json) => {
    // Parse first: an invalid document must never touch the live project.
    let next: MapEditorProject;
    try {
      next = parseProject(json);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Invalid project JSON.';
      set({ status: { message, severity: 'error' } });
      throw new Error(message);
    }

    // Undo/redo survives: the pre-edit state goes on the stack like any
    // other mutation, so Ctrl+Z steps back out of the JSON edit.
    get().commitHistory();
    set({
      project: next,
      isDirty: true,
      selection: emptySelection(),
      edgeDraftFromId: null,
      status: { message: 'Project JSON applied.', severity: 'success' },
    });
    setTimeout(() => get().fitToScreen(), 30);
  },

  setActiveBuilding: (buildingId) => {
    set((s) => ({
      project: setActiveBuildingInProject(s.project, buildingId),
      selection: emptySelection(),
      // Keep a half-drawn edge alive across the switch — that is how a
      // cross-building edge gets drawn.
      edgeDraftFromId: s.tool === 'add-edge' ? s.edgeDraftFromId : null,
    }));
    setTimeout(() => get().fitToScreen(), 30);
  },

  addBuilding: () => {
    get().commitHistory();
    const project = addBuildingToProject(get().project);
    set({
      project,
      isDirty: true,
      selection: emptySelection(),
      status: {
        message: `Added ${
          project.buildings[project.buildings.length - 1].name
        }`,
        severity: 'success',
      },
    });
  },

  removeBuilding: (buildingId) => {
    const { project } = get();
    const target = project.buildings.find((b) => b.id === buildingId);
    if (!target) return;
    if (project.buildings.length <= 1) {
      set({
        status: {
          message: 'At least one building is required.',
          severity: 'error',
        },
      });
      return;
    }

    get().commitHistory();
    set({
      project: removeBuildingFromProject(project, buildingId),
      isDirty: true,
      selection: emptySelection(),
      status: { message: `Removed ${target.name}`, severity: 'info' },
    });
  },

  renameBuilding: (buildingId, name) => {
    get().commitHistory();
    set((s) => ({
      project: updateBuildingInProject(s.project, buildingId, (b) => ({
        ...b,
        name,
      })),
      isDirty: true,
    }));
  },

  setBuildingDescription: (buildingId, description) => {
    get().commitHistory();
    set((s) => ({
      project: updateBuildingInProject(s.project, buildingId, (b) => ({
        ...b,
        description,
      })),
      isDirty: true,
    }));
  },

  duplicateBuilding: (buildingId) => {
    try {
      get().commitHistory();
      const project = duplicateBuildingInProject(get().project, buildingId);
      set({
        project,
        isDirty: true,
        selection: emptySelection(),
        status: {
          message: `Duplicated to ${
            project.buildings.find((b) => b.id === project.activeBuildingId)
              ?.name
          }`,
          severity: 'success',
        },
      });
      setTimeout(() => get().fitToScreen(), 30);
    } catch (err) {
      set({
        status: {
          message:
            err instanceof Error ? err.message : 'Cannot duplicate building',
          severity: 'error',
        },
      });
    }
  },

  moveBuilding: (buildingId, delta) => {
    const { project } = get();
    const index = project.buildings.findIndex((b) => b.id === buildingId);
    if (index === -1) return;

    // Validate before committing history so no-op moves cannot pollute undo.
    const target = index + delta;
    if (target < 0 || target >= project.buildings.length || target === index) {
      return;
    }

    get().commitHistory();
    set({
      project: reorderBuildingInProject(project, buildingId, target),
      isDirty: true,
    });
  },

  setActiveFloor: (floorId) => {
    set((s) => ({
      project: setActiveFloorInProject(s.project, floorId),
      selection: emptySelection(),
      // Keep a half-drawn edge alive across the switch — that is how a
      // cross-floor edge gets drawn.
      edgeDraftFromId: s.tool === 'add-edge' ? s.edgeDraftFromId : null,
    }));
    setTimeout(() => get().fitToScreen(), 30);
  },

  addFloor: (buildingId) => {
    try {
      const targetId = buildingId ?? get().project.activeBuildingId;
      get().commitHistory();
      const project = addFloorToProject(get().project, targetId);
      set({
        project,
        isDirty: true,
        selection: emptySelection(),
        status: {
          message: `Added ${getActiveFloor(project).name}`,
          severity: 'success',
        },
      });
    } catch (err) {
      set({
        status: {
          message: err instanceof Error ? err.message : 'Cannot add floor',
          severity: 'error',
        },
      });
    }
  },

  removeFloor: (floorId) => {
    try {
      const name = findFloorLocation(get().project.buildings, floorId)?.floor
        .name;
      get().commitHistory();
      const project = removeFloorFromProject(get().project, floorId);
      set({
        project,
        isDirty: true,
        selection: emptySelection(),
        status: {
          message: `Removed ${name ?? `floor ${floorId}`}`,
          severity: 'info',
        },
      });
    } catch (err) {
      set({
        status: {
          message: err instanceof Error ? err.message : 'Cannot remove floor',
          severity: 'error',
        },
      });
    }
  },

  renameFloor: (floorId, name) => {
    get().commitHistory();
    set((s) => ({
      project: updateFloorInProject(s.project, floorId, (f) => ({
        ...f,
        name,
      })),
      isDirty: true,
    }));
  },

  moveFloor: (floorId, delta) => {
    const { project } = get();
    const location = findFloorLocation(project.buildings, floorId);
    if (!location) return;

    // Floors reorder within their own building only.
    const siblings = location.building.floors;
    const index = siblings.findIndex((f) => f.id === floorId);

    // Validate before committing history so no-op moves cannot pollute undo.
    const target = index + delta;
    if (target < 0 || target >= siblings.length || target === index) {
      return;
    }

    get().commitHistory();
    set({
      project: reorderFloorInProject(project, floorId, target),
      isDirty: true,
    });
  },

  openImageForActiveFloor: async () => {
    try {
      const image = await openFloorImage();
      if (!image) return;
      get().commitHistory();
      const floorId = get().project.activeFloorId;
      set((s) => ({
        project: updateFloorInProject(s.project, floorId, (f) => ({
          ...f,
          imageName: image.name,
          imageDataUrl: image.dataUrl,
          imageWidth: image.width,
          imageHeight: image.height,
        })),
        isDirty: true,
        status: {
          message: `Loaded ${image.name} (${image.width}×${image.height})`,
          severity: 'success',
        },
      }));
      setTimeout(() => get().fitToScreen(), 30);
    } catch (err) {
      set({
        status: {
          message: err instanceof Error ? err.message : 'Failed to open image',
          severity: 'error',
        },
      });
    }
  },

  addNodeAt: (worldX, worldY) => {
    get().commitHistory();
    const floorId = get().project.activeFloorId;
    const type = get().defaultNodeType;
    let newNodeId = '';
    set((s) => {
      const project = updateFloorInProject(s.project, floorId, (f) => {
        const next = addNodeToFloor(f, {
          floor: floorId,
          x: worldX,
          y: worldY,
          type,
          label: '',
        });
        newNodeId = next.nodes[next.nodes.length - 1].id;
        return next;
      });
      return {
        project,
        isDirty: true,
        selection: { nodeIds: [newNodeId], edgeIds: [] },
        status: {
          message: `Node created at (${Math.round(worldX)}, ${Math.round(worldY)})`,
          severity: 'info',
        },
      };
    });
  },

  updateSelectedNode: (patch) => {
    const { selection } = get();
    if (selection.nodeIds.length !== 1) return;
    get().updateNode(selection.nodeIds[0], patch);
  },

  updateNode: (nodeId, patch) => {
    get().commitHistory();
    const floorId = get().project.activeFloorId;
    set((s) => ({
      project: updateNodeInProject(s.project, floorId, nodeId, patch),
      isDirty: true,
    }));
  },

  renameNodeId: (oldId, newId) => {
    const trimmed = newId.trim();
    if (trimmed === oldId) {
      return;
    }

    const floorId = get().project.activeFloorId;
    const floor = get().getActiveFloor();

    // Validate before touching history so failed renames cannot pollute undo.
    // Scope is project-wide: edges reference nodes by id alone.
    const validationError = validateNodeId(
      collectNodeIds(get().project),
      trimmed,
      { excludeId: oldId }
    );
    if (validationError) {
      set({
        status: { message: validationError, severity: 'error' },
      });
      throw new Error(validationError);
    }
    if (!floor.nodes.some((n) => n.id === oldId)) {
      const message = `Node "${oldId}" not found.`;
      set({ status: { message, severity: 'error' } });
      throw new Error(message);
    }

    // Apply the transform first — renaming rewrites every edge endpoint that
    // referenced the old id — and only then commit one undo snapshot.
    let nextProject;
    try {
      nextProject = renameNodeIdInProject(
        get().project,
        floorId,
        oldId,
        trimmed
      );
    } catch (err) {
      set({
        status: {
          message: err instanceof Error ? err.message : 'Cannot rename node ID',
          severity: 'error',
        },
      });
      throw err;
    }

    get().commitHistory();
    set((s) => ({
      project: nextProject,
      selection: {
        nodeIds: s.selection.nodeIds.map((id) =>
          id === oldId ? trimmed : id
        ),
        edgeIds: s.selection.edgeIds,
      },
      edgeDraftFromId:
        s.edgeDraftFromId === oldId ? trimmed : s.edgeDraftFromId,
      isDirty: true,
      status: {
        message: `Node ID renamed: ${oldId} → ${trimmed}`,
        severity: 'success',
      },
    }));
  },

  moveSelectedNodes: (dx, dy) => {
    const ids = get().selection.nodeIds;
    if (ids.length === 0) return;
    get().commitHistory();
    const floorId = get().project.activeFloorId;
    set((s) => ({
      project: moveNodesInProject(s.project, floorId, ids, dx, dy),
      isDirty: true,
    }));
  },

  moveNodesLive: (nodeIds, dx, dy) => {
    if (nodeIds.length === 0) return;
    const floorId = get().project.activeFloorId;
    set((s) => ({
      project: moveNodesInProject(s.project, floorId, nodeIds, dx, dy),
      isDirty: true,
    }));
  },

  deleteSelection: () => {
    const { selection } = get();
    if (selection.nodeIds.length === 0 && selection.edgeIds.length === 0) {
      return;
    }
    get().commitHistory();
    const floorId = get().project.activeFloorId;
    set((s) => {
      let project = s.project;
      if (selection.nodeIds.length > 0) {
        // Also drops every edge touching them, wherever it originates.
        project = deleteNodesInProject(project, floorId, selection.nodeIds);
      }
      if (selection.edgeIds.length > 0) {
        project = deleteEdgesInProject(project, selection.edgeIds);
      }
      return {
        project,
        isDirty: true,
        selection: emptySelection(),
        status: { message: 'Deleted selection', severity: 'info' },
      };
    });
  },

  connectEdge: (fromId, toId) => {
    const { project } = get();

    // Validate up front so the dialog never opens on an impossible edge.
    if (fromId === toId) {
      set({
        edgeDraftFromId: null,
        status: {
          message: 'Cannot create an edge from a node to itself.',
          severity: 'warning',
        },
      });
      return;
    }
    if (project.edges.some((e) => e.from === fromId && e.to === toId)) {
      set({
        edgeDraftFromId: null,
        status: {
          message: 'Edge already exists between these nodes.',
          severity: 'warning',
        },
      });
      return;
    }

    set({ pendingEdge: { fromId, toId } });
  },

  confirmPendingEdge: (settings) => {
    const pending = get().pendingEdge;
    if (!pending) return;

    try {
      get().commitHistory();
      const project = createEdgeInProject(get().project, {
        from: pending.fromId,
        to: pending.toId,
        edgeType: settings.edgeType,
        weight: settings.weight,
        bidirectional: settings.bidirectional,
      });
      const created = project.edges[project.edges.length - 1];
      set({
        project,
        isDirty: true,
        pendingEdge: null,
        edgeDraftFromId: null,
        selection: { nodeIds: [], edgeIds: [created.id] },
        status: { message: 'Edge created', severity: 'success' },
      });
    } catch (err) {
      set({
        pendingEdge: null,
        edgeDraftFromId: null,
        status: {
          message: err instanceof Error ? err.message : 'Cannot create edge',
          severity: 'warning',
        },
      });
    }
  },

  cancelPendingEdge: () =>
    set({
      pendingEdge: null,
      edgeDraftFromId: null,
      status: { message: 'Edge creation cancelled', severity: 'info' },
    }),

  updateSelectedEdge: (patch) => {
    const { selection } = get();
    if (selection.edgeIds.length !== 1) return;
    get().updateEdge(selection.edgeIds[0], patch);
  },

  updateEdge: (edgeId, patch) => {
    get().commitHistory();
    set((s) => ({
      project: updateEdgeInProject(s.project, edgeId, patch),
      isDirty: true,
    }));
  },

  deleteEdges: (edgeIds) => {
    if (edgeIds.length === 0) return;
    get().commitHistory();
    set((s) => {
      const removed = new Set(edgeIds);
      return {
        project: deleteEdgesInProject(s.project, edgeIds),
        // Drop the removed edges from the selection so nothing dangles.
        selection: {
          nodeIds: s.selection.nodeIds,
          edgeIds: s.selection.edgeIds.filter((id) => !removed.has(id)),
        },
        isDirty: true,
        status: {
          message: `Deleted ${edgeIds.length} edge${edgeIds.length === 1 ? '' : 's'}`,
          severity: 'info',
        },
      };
    });
  },

  renameEdgeId: (oldId, newId) => {
    const trimmed = newId.trim();
    if (trimmed === oldId) return;

    // Validate before touching history so failed renames cannot pollute undo.
    let next;
    try {
      next = renameEdgeIdInProject(get().project, oldId, trimmed);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Cannot rename edge ID';
      set({ status: { message, severity: 'error' } });
      throw new Error(message);
    }

    get().commitHistory();
    set((s) => ({
      project: next,
      selection: {
        nodeIds: s.selection.nodeIds,
        edgeIds: s.selection.edgeIds.map((id) =>
          id === oldId ? trimmed : id
        ),
      },
      isDirty: true,
      status: {
        message: `Edge ID renamed: ${oldId} → ${trimmed}`,
        severity: 'success',
      },
    }));
  },

  setEdgeEndpoints: (edgeId, fromId, toId) => {
    let next;
    try {
      next = setEdgeEndpointsInProject(get().project, edgeId, fromId, toId);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Cannot change endpoints';
      set({ status: { message, severity: 'error' } });
      throw new Error(message);
    }

    get().commitHistory();
    set({ project: next, isDirty: true });
  },

  goToNode: (nodeId) => {
    const { project, stageSize, viewport } = get();
    const location = buildNodeIndex(project).get(nodeId);
    if (!location) {
      set({
        status: { message: `Node "${nodeId}" not found.`, severity: 'warning' },
      });
      return;
    }

    const { node, floor, building } = location;
    set({
      project: {
        ...project,
        activeBuildingId: building.id,
        activeFloorId: floor.id,
      },
      selection: { nodeIds: [node.id], edgeIds: [] },
      edgeDraftFromId: null,
      // Centre on the node, holding the current zoom.
      viewport: {
        scale: viewport.scale,
        x: stageSize.width / 2 - node.x * viewport.scale,
        y: stageSize.height / 2 - node.y * viewport.scale,
      },
      status: {
        message: `${building.name} · ${floor.name} — ${node.label || node.id}`,
        severity: 'info',
      },
    });
  },

  goToEdge: (edgeId) => {
    const { project } = get();
    const edge = project.edges.find((e) => e.id === edgeId);
    if (!edge) return;

    // Land on the source endpoint, then highlight the edge itself.
    get().goToNode(edge.from);
    set({ selection: { nodeIds: [], edgeIds: [edgeId] } });
  },

  addNodeProperty: (nodeId, key, type, options) => {
    try {
      get().commitHistory();
      const floorId = get().project.activeFloorId;
      set((s) => ({
        project: updateFloorInProject(s.project, floorId, (f) =>
          addNodePropertyOnFloor(f, nodeId, key, type, options)
        ),
        isDirty: true,
        status: { message: `Property "${key}" added`, severity: 'info' },
      }));
    } catch (err) {
      set({
        status: {
          message: err instanceof Error ? err.message : 'Cannot add property',
          severity: 'error',
        },
      });
      throw err;
    }
  },

  renameNodeProperty: (nodeId, oldKey, newKey) => {
    try {
      get().commitHistory();
      const floorId = get().project.activeFloorId;
      set((s) => ({
        project: updateFloorInProject(s.project, floorId, (f) =>
          renameNodePropertyOnFloor(f, nodeId, oldKey, newKey)
        ),
        isDirty: true,
        status: {
          message: `Property renamed to "${newKey}"`,
          severity: 'info',
        },
      }));
    } catch (err) {
      set({
        status: {
          message: err instanceof Error ? err.message : 'Cannot rename property',
          severity: 'error',
        },
      });
      throw err;
    }
  },

  deleteNodeProperty: (nodeId, key) => {
    get().commitHistory();
    const floorId = get().project.activeFloorId;
    set((s) => ({
      project: updateFloorInProject(s.project, floorId, (f) =>
        deleteNodePropertyOnFloor(f, nodeId, key)
      ),
      isDirty: true,
      status: { message: `Property "${key}" removed`, severity: 'info' },
    }));
  },

  setNodePropertyValue: (nodeId, key, value) => {
    try {
      get().commitHistory();
      const floorId = get().project.activeFloorId;
      set((s) => ({
        project: updateFloorInProject(s.project, floorId, (f) =>
          setNodePropertyValueOnFloor(f, nodeId, key, value)
        ),
        isDirty: true,
      }));
    } catch (err) {
      set({
        status: {
          message: err instanceof Error ? err.message : 'Cannot update property',
          severity: 'error',
        },
      });
    }
  },

  setNodePropertySchema: (nodeId, key, schema) => {
    try {
      get().commitHistory();
      const floorId = get().project.activeFloorId;
      set((s) => ({
        project: updateFloorInProject(s.project, floorId, (f) =>
          setNodePropertySchemaOnFloor(f, nodeId, key, schema)
        ),
        isDirty: true,
      }));
    } catch (err) {
      set({
        status: {
          message:
            err instanceof Error ? err.message : 'Cannot update property type',
          severity: 'error',
        },
      });
      throw err;
    }
  },
}));

/** Hit-test radius in world units depends on zoom for consistent UX. */
export function worldHitRadius(scale: number): number {
  return NODE_HIT_RADIUS / Math.max(scale, 0.01);
}
