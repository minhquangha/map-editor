import { create } from 'zustand';
import type {
  EdgeType,
  EditorTool,
  Floor,
  MapEditorProject,
  NodeType,
  SelectionState,
  Viewport,
} from '@/models/types';
import {
  addFloorToProject,
  cloneFloors,
  createEmptyProject,
  getActiveFloor,
  removeFloorFromProject,
  updateFloorInProject,
} from '@/services/projectService';
import {
  addNodeToFloor,
  createEdgeOnFloor,
  deleteEdgesFromFloor,
  deleteNodesFromFloor,
  moveNodesOnFloor,
  updateEdgeOnFloor,
  updateNodeOnFloor,
} from '@/services/graphService';
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
  /** First node id when creating an edge (click A then B). */
  edgeDraftFromId: string | null;
  status: EditorStatus | null;
  showNodeLabels: boolean;
  showDistances: boolean;
  isPanning: boolean;

  // ── Derived helpers ──────────────────────────────────────────────────────
  getActiveFloor: () => Floor;
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

  // ── Floors ───────────────────────────────────────────────────────────────
  setActiveFloor: (floorId: number) => void;
  addFloor: () => void;
  removeFloor: (floorId: number) => void;
  renameFloor: (floorId: number, name: string) => void;
  openImageForActiveFloor: () => Promise<void>;

  // ── Graph mutations ──────────────────────────────────────────────────────
  addNodeAt: (worldX: number, worldY: number) => void;
  updateSelectedNode: (
    patch: Partial<{ x: number; y: number; label: string; type: NodeType }>
  ) => void;
  updateNode: (
    nodeId: string,
    patch: Partial<{ x: number; y: number; label: string; type: NodeType }>
  ) => void;
  moveSelectedNodes: (dx: number, dy: number) => void;
  /** Live move without history (during drag). */
  moveNodesLive: (nodeIds: string[], dx: number, dy: number) => void;
  deleteSelection: () => void;
  connectEdge: (fromId: string, toId: string) => void;
  updateSelectedEdge: (
    patch: Partial<{ edgeType: EdgeType; bidirectional: boolean; distance: number }>
  ) => void;
  updateEdge: (
    edgeId: string,
    patch: Partial<{ edgeType: EdgeType; bidirectional: boolean; distance: number }>
  ) => void;
}

function emptySelection(): SelectionState {
  return { nodeIds: [], edgeIds: [] };
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
  status: { message: 'Ready — open a floor plan image to begin.', severity: 'info' },
  showNodeLabels: true,
  showDistances: false,
  isPanning: false,

  getActiveFloor: () => getActiveFloor(get().project),
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
    const floor = get().getActiveFloor();
    set({
      selection: {
        nodeIds: floor.nodes.map((n) => n.id),
        edgeIds: floor.edges.map((e) => e.id),
      },
    });
  },

  commitHistory: () => {
    const { project, selection, history } = get();
    const snapshot = createSnapshot(
      project.floors,
      project.activeFloorId,
      selection
    );
    set({ history: pushHistory(history, snapshot) });
  },

  undo: () => {
    const { history, project, selection } = get();
    const current = createSnapshot(
      project.floors,
      project.activeFloorId,
      selection
    );
    const result = historyUndo(history, current);
    if (!result) return;
    set({
      history: result.history,
      project: {
        ...project,
        floors: cloneFloors(result.snapshot.floors),
        activeFloorId: result.snapshot.activeFloorId,
      },
      selection: result.snapshot.selection,
      isDirty: true,
      edgeDraftFromId: null,
      status: { message: 'Undo', severity: 'info' },
    });
  },

  redo: () => {
    const { history, project, selection } = get();
    const current = createSnapshot(
      project.floors,
      project.activeFloorId,
      selection
    );
    const result = historyRedo(history, current);
    if (!result) return;
    set({
      history: result.history,
      project: {
        ...project,
        floors: cloneFloors(result.snapshot.floors),
        activeFloorId: result.snapshot.activeFloorId,
      },
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

  setActiveFloor: (floorId) => {
    set((s) => ({
      project: { ...s.project, activeFloorId: floorId },
      selection: emptySelection(),
      edgeDraftFromId: null,
    }));
    setTimeout(() => get().fitToScreen(), 30);
  },

  addFloor: () => {
    try {
      get().commitHistory();
      const project = addFloorToProject(get().project);
      set({
        project,
        isDirty: true,
        selection: emptySelection(),
        status: {
          message: `Added ${project.floors.find((f) => f.id === project.activeFloorId)?.name}`,
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
      get().commitHistory();
      const project = removeFloorFromProject(get().project, floorId);
      set({
        project,
        isDirty: true,
        selection: emptySelection(),
        status: { message: `Removed floor ${floorId}`, severity: 'info' },
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
      project: updateFloorInProject(s.project, floorId, (f) =>
        updateNodeOnFloor(f, nodeId, patch)
      ),
      isDirty: true,
    }));
  },

  moveSelectedNodes: (dx, dy) => {
    const ids = get().selection.nodeIds;
    if (ids.length === 0) return;
    get().commitHistory();
    const floorId = get().project.activeFloorId;
    set((s) => ({
      project: updateFloorInProject(s.project, floorId, (f) =>
        moveNodesOnFloor(f, ids, dx, dy)
      ),
      isDirty: true,
    }));
  },

  moveNodesLive: (nodeIds, dx, dy) => {
    if (nodeIds.length === 0) return;
    const floorId = get().project.activeFloorId;
    set((s) => ({
      project: updateFloorInProject(s.project, floorId, (f) =>
        moveNodesOnFloor(f, nodeIds, dx, dy)
      ),
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
        project = updateFloorInProject(project, floorId, (f) =>
          deleteNodesFromFloor(f, selection.nodeIds)
        );
      }
      if (selection.edgeIds.length > 0) {
        project = updateFloorInProject(project, floorId, (f) =>
          deleteEdgesFromFloor(f, selection.edgeIds)
        );
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
    try {
      get().commitHistory();
      const floorId = get().project.activeFloorId;
      let newEdgeId = '';
      set((s) => {
        const project = updateFloorInProject(s.project, floorId, (f) => {
          const next = createEdgeOnFloor(f, { from: fromId, to: toId });
          newEdgeId = next.edges[next.edges.length - 1].id;
          return next;
        });
        return {
          project,
          isDirty: true,
          edgeDraftFromId: null,
          selection: { nodeIds: [], edgeIds: [newEdgeId] },
          status: { message: 'Edge created', severity: 'success' },
        };
      });
    } catch (err) {
      set({
        edgeDraftFromId: null,
        status: {
          message: err instanceof Error ? err.message : 'Cannot create edge',
          severity: 'warning',
        },
      });
    }
  },

  updateSelectedEdge: (patch) => {
    const { selection } = get();
    if (selection.edgeIds.length !== 1) return;
    get().updateEdge(selection.edgeIds[0], patch);
  },

  updateEdge: (edgeId, patch) => {
    get().commitHistory();
    const floorId = get().project.activeFloorId;
    set((s) => ({
      project: updateFloorInProject(s.project, floorId, (f) =>
        updateEdgeOnFloor(f, edgeId, patch)
      ),
      isDirty: true,
    }));
  },
}));

/** Hit-test radius in world units depends on zoom for consistent UX. */
export function worldHitRadius(scale: number): number {
  return NODE_HIT_RADIUS / Math.max(scale, 0.01);
}
