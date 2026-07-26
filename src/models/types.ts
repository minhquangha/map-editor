/** Node classification for facility graph digitization. */
export type NodeType =
  | 'NORMAL'
  | 'ROOM'
  | 'ELEVATOR'
  | 'STAIR'
  | 'ENTRANCE'
  | 'EXIT';

/**
 * Edge classification.
 * `STAIR` is kept (rather than `STAIRS`) so version 1/2 documents load as-is.
 */
export type EdgeType =
  | 'NORMAL'
  | 'ELEVATOR'
  | 'STAIR'
  | 'ESCALATOR'
  | 'BRIDGE'
  | 'TUNNEL'
  | 'OUTDOOR'
  | 'CUSTOM';

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

/**
 * Free-form metadata bag carried by projects, buildings and floors.
 *
 * Nothing in the editor interprets these keys — they round-trip through
 * save / load / export untouched so integrations and the JSON editor can
 * attach arbitrary data without a schema change.
 */
export type Metadata = Record<string, unknown>;

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

/**
 * A directed connection between two nodes.
 *
 * Lives on the project, not on a floor: endpoints may sit on different floors
 * (and, later, different buildings). `from`/`to` keep their original names so
 * existing documents and export consumers are unaffected.
 */
export interface GraphEdge {
  id: string;
  from: string;
  to: string;
  /**
   * Euclidean pixel length between the endpoints.
   * Auto-maintained for same-floor edges; `0` for cross-floor edges, whose
   * endpoints live in unrelated coordinate spaces.
   */
  distance: number;
  /**
   * Routing cost consumed by pathfinding backends. Defaults to
   * `DEFAULT_EDGE_WEIGHT`. Unlike `distance` this is never recomputed —
   * it is whatever the user sets.
   */
  weight: number;
  edgeType: EdgeType;
  /** When true, the reverse edge is implied / stored as bidirectional. */
  bidirectional: boolean;
  /** Free-form, editor-agnostic data. */
  metadata?: Metadata;
}

/**
 * One floor with an independent coordinate space (origin top-left).
 * Belongs to exactly one building; `id` is unique across the whole project.
 */
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
  /** Free-form, editor-agnostic data. */
  metadata?: Metadata;
}

/** A building owning an ordered, unbounded collection of floors. */
export interface Building {
  id: number;
  name: string;
  description?: string;
  floors: Floor[];
  /** Free-form, editor-agnostic data. */
  metadata?: Metadata;
}

/** Project-level metadata. Extra keys are preserved verbatim. */
export interface ProjectMetadata {
  hospitalName?: string;
  description?: string;
  [key: string]: unknown;
}

/** Full project document (.mapeditor). */
export interface MapEditorProject {
  version: 3;
  name: string;
  createdAt: string;
  updatedAt: string;
  /** Building owning the active floor. */
  activeBuildingId: number;
  /** Active floor id (unique project-wide). */
  activeFloorId: number;
  buildings: Building[];
  /**
   * The graph layer: every edge in the project, including those whose
   * endpoints sit on different floors. Floors own nodes; the project owns
   * the connections between them.
   */
  edges: GraphEdge[];
  metadata?: ProjectMetadata;
}

/** Where a node lives. Resolved through the node index, never stored. */
export interface NodeLocation {
  node: GraphNode;
  floor: Floor;
  building: Building;
}

/** One edge as seen from a node, for the Connections panel. */
export interface NodeConnection {
  edge: GraphEdge;
  /** The node at the other end. */
  target: NodeLocation;
  /** True when this node is the edge's `from`. */
  outgoing: boolean;
  /** True when the endpoints sit on different floors. */
  crossFloor: boolean;
  /** True when the endpoints sit in different buildings. */
  crossBuilding: boolean;
}

/** Export format consumed by pathfinding backends. */
export interface ExportGraph {
  buildings: ExportBuilding[];
  /**
   * Flat list of every floor across every building.
   * Retained so consumers written against the single-building format keep
   * working; floor ids are unique project-wide, so this stays unambiguous.
   */
  floors: ExportFloor[];
  /**
   * Every edge in the project, same-floor and cross-floor alike.
   * This is the authoritative edge list — the per-floor `edges` arrays only
   * carry the same-floor subset, for backward compatibility.
   */
  edges: ExportEdge[];
}

export interface ExportBuilding {
  id: number;
  name: string;
  description?: string;
  floors: ExportFloor[];
  metadata?: Metadata;
}

export interface ExportFloor {
  id: number;
  /** Owning building id. */
  building: number;
  image: string;
  nodes: ExportNode[];
  edges: ExportEdge[];
  metadata?: Metadata;
}

export interface ExportNode {
  id: string;
  /** Owning building id. */
  building: number;
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
  id: string;
  from: string;
  to: string;
  /** Resolved location of the `from` endpoint. */
  fromBuilding: number;
  fromFloor: number;
  /** Resolved location of the `to` endpoint. */
  toBuilding: number;
  toFloor: number;
  distance: number;
  weight: number;
  edgeType: EdgeType;
  bidirectional: boolean;
  /** True when the endpoints sit on different floors. */
  crossFloor: boolean;
  metadata?: Metadata;
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
  buildings: Building[];
  edges: GraphEdge[];
  activeBuildingId: number;
  activeFloorId: number;
  selection: SelectionState;
}
