/** Node classification for hospital graph digitization. */
export type NodeType =
  | 'NORMAL'
  | 'ROOM'
  | 'ELEVATOR'
  | 'STAIR'
  | 'ENTRANCE'
  | 'EXIT';

/** Edge classification. */
export type EdgeType = 'NORMAL' | 'STAIR' | 'ELEVATOR';

/** Editor tool currently active in the toolbar. */
export type EditorTool =
  | 'pointer'
  | 'pan'
  | 'add-node'
  | 'add-edge'
  | 'delete';

/** Supported custom property value kinds. */
export type CustomPropertyType =
  | 'string'
  | 'number'
  | 'boolean'
  | 'enum'
  | 'array';

/** Type metadata for a single custom property key (drives UI editors). */
export interface CustomPropertySchema {
  type: CustomPropertyType;
  /** Choices when type is `enum`. */
  options?: string[];
}

/** A graph vertex placed on a floor plan (pixel coordinates). */
export interface GraphNode {
  id: string;
  floor: number;
  x: number;
  y: number;
  label: string;
  type: NodeType;
  /** Free-text room type (e.g. "Blood Test"). Built-in field. */
  room_type: string;
  /**
   * Unlimited custom property values.
   * Keys are user-defined; values are typed via `propertySchema`.
   */
  properties: Record<string, unknown>;
  /**
   * Schema for each key in `properties`.
   * Persisted in the project file so editors round-trip correctly.
   */
  propertySchema: Record<string, CustomPropertySchema>;
}

/** A directed connection between two nodes. */
export interface GraphEdge {
  id: string;
  from: string;
  to: string;
  distance: number;
  edgeType: EdgeType;
  /** When true, the reverse edge is implied / stored as bidirectional. */
  bidirectional: boolean;
}

/** One hospital floor with independent coordinate space (origin top-left). */
export interface Floor {
  id: number;
  name: string;
  /** Original file name for export reference. */
  imageName: string | null;
  /** Embedded data URL of the background image. */
  imageDataUrl: string | null;
  /** Natural pixel width of the background image. */
  imageWidth: number;
  /** Natural pixel height of the background image. */
  imageHeight: number;
  nodes: GraphNode[];
  edges: GraphEdge[];
}

/** Full project document (.mapeditor). */
export interface MapEditorProject {
  version: 1;
  name: string;
  createdAt: string;
  updatedAt: string;
  activeFloorId: number;
  floors: Floor[];
  /** Optional metadata for the backend consumer. */
  metadata?: {
    hospitalName?: string;
    description?: string;
  };
}

/** Export format consumed by pathfinding backends. */
export interface ExportGraph {
  floors: ExportFloor[];
}

export interface ExportFloor {
  id: number;
  image: string;
  nodes: ExportNode[];
  edges: ExportEdge[];
}

export interface ExportNode {
  id: string;
  floor: number;
  x: number;
  y: number;
  label: string;
  type: NodeType;
  room_type: string;
  /** Custom properties exported for backend consumption. */
  properties: Record<string, unknown>;
}

export interface ExportEdge {
  from: string;
  to: string;
  distance: number;
  edgeType: EdgeType;
  bidirectional: boolean;
}

/** Selection state on the canvas. */
export interface SelectionState {
  nodeIds: string[];
  edgeIds: string[];
}

/** Viewport transform for the infinite canvas. */
export interface Viewport {
  x: number;
  y: number;
  scale: number;
}

/** Snapshot used by undo/redo. */
export interface HistorySnapshot {
  floors: Floor[];
  activeFloorId: number;
  selection: SelectionState;
}
