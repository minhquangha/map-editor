import type {
  Building,
  GraphEdge,
  HistorySnapshot,
  SelectionState,
} from '@/models/types';
import { cloneBuildings, cloneEdges } from './buildingService';
import { HISTORY_LIMIT } from '@/utils/constants';

export interface HistoryState {
  past: HistorySnapshot[];
  future: HistorySnapshot[];
}

export function createEmptyHistory(): HistoryState {
  return { past: [], future: [] };
}

export function createSnapshot(
  buildings: Building[],
  edges: GraphEdge[],
  activeBuildingId: number,
  activeFloorId: number,
  selection: SelectionState
): HistorySnapshot {
  return {
    buildings: cloneBuildings(buildings),
    edges: cloneEdges(edges),
    activeBuildingId,
    activeFloorId,
    selection: {
      nodeIds: [...selection.nodeIds],
      edgeIds: [...selection.edgeIds],
    },
  };
}

/**
 * Push current state onto the past stack before a mutating action.
 * Clears the redo (future) stack.
 */
export function pushHistory(
  history: HistoryState,
  snapshot: HistorySnapshot
): HistoryState {
  const past = [...history.past, snapshot];
  if (past.length > HISTORY_LIMIT) {
    past.shift();
  }
  return { past, future: [] };
}

export function undo(
  history: HistoryState,
  current: HistorySnapshot
): { history: HistoryState; snapshot: HistorySnapshot } | null {
  if (history.past.length === 0) return null;
  const past = [...history.past];
  const snapshot = past.pop()!;
  return {
    history: {
      past,
      future: [...history.future, current],
    },
    snapshot,
  };
}

export function redo(
  history: HistoryState,
  current: HistorySnapshot
): { history: HistoryState; snapshot: HistorySnapshot } | null {
  if (history.future.length === 0) return null;
  const future = [...history.future];
  const snapshot = future.pop()!;
  return {
    history: {
      past: [...history.past, current],
      future,
    },
    snapshot,
  };
}

export function canUndo(history: HistoryState): boolean {
  return history.past.length > 0;
}

export function canRedo(history: HistoryState): boolean {
  return history.future.length > 0;
}
