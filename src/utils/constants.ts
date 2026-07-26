import type { EdgeType, NodeType } from '@/models/types';

export const APP_NAME = 'Map Editor';
export const PROJECT_EXTENSION = 'mapeditor';
export const PROJECT_VERSION = 1 as const;

export const MAX_FLOORS = 7;
export const MIN_FLOOR = 1;

export const NODE_RADIUS = 8;
export const NODE_HIT_RADIUS = 12;
export const EDGE_HIT_WIDTH = 10;

export const MIN_ZOOM = 0.05;
export const MAX_ZOOM = 8;
export const ZOOM_STEP = 1.1;
export const WHEEL_ZOOM_SENSITIVITY = 0.0015;

export const GRID_SIZE = 50;
export const AUTO_SAVE_INTERVAL_MS = 30_000;
export const HISTORY_LIMIT = 100;

export const NODE_TYPE_OPTIONS: { value: NodeType; label: string; color: string }[] = [
  { value: 'NORMAL', label: 'Normal', color: '#42a5f5' },
  { value: 'ROOM', label: 'Room', color: '#66bb6a' },
  { value: 'ELEVATOR', label: 'Elevator', color: '#ab47bc' },
  { value: 'STAIR', label: 'Stair', color: '#ffa726' },
  { value: 'ENTRANCE', label: 'Entrance', color: '#26c6da' },
  { value: 'EXIT', label: 'Exit', color: '#ef5350' },
];

export const EDGE_TYPE_OPTIONS: { value: EdgeType; label: string; color: string }[] = [
  { value: 'NORMAL', label: 'Normal', color: '#90caf9' },
  { value: 'STAIR', label: 'Stair', color: '#ffb74d' },
  { value: 'ELEVATOR', label: 'Elevator', color: '#ce93d8' },
];

export const NODE_COLORS: Record<NodeType, string> = {
  NORMAL: '#42a5f5',
  ROOM: '#66bb6a',
  ELEVATOR: '#ab47bc',
  STAIR: '#ffa726',
  ENTRANCE: '#26c6da',
  EXIT: '#ef5350',
};

export const EDGE_COLORS: Record<EdgeType, string> = {
  NORMAL: '#90caf9',
  STAIR: '#ffb74d',
  ELEVATOR: '#ce93d8',
};

export const SELECTION_COLOR = '#ffeb3b';
export const HOVER_COLOR = '#ffffff';
export const PREVIEW_EDGE_COLOR = '#ff9800';

export function defaultFloorName(id: number): string {
  return `Floor ${id}`;
}
