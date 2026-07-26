import type { GraphNode, Viewport } from '@/models/types';
import { MAX_ZOOM, MIN_ZOOM } from './constants';

/** Euclidean distance between two points in pixel space. */
export function euclideanDistance(
  x1: number,
  y1: number,
  x2: number,
  y2: number
): number {
  const dx = x2 - x1;
  const dy = y2 - y1;
  return Math.sqrt(dx * dx + dy * dy);
}

/** Distance between two graph nodes. */
export function nodeDistance(a: GraphNode, b: GraphNode): number {
  return euclideanDistance(a.x, a.y, b.x, b.y);
}

/** Round to a stable precision for storage (sub-pixel not useful for pathfinding). */
export function roundCoord(value: number, decimals = 2): number {
  const f = 10 ** decimals;
  return Math.round(value * f) / f;
}

export function roundDistance(value: number): number {
  return roundCoord(value, 3);
}

/** Convert screen (stage) coordinates to world (image pixel) coordinates. */
export function screenToWorld(
  screenX: number,
  screenY: number,
  viewport: Viewport
): { x: number; y: number } {
  return {
    x: (screenX - viewport.x) / viewport.scale,
    y: (screenY - viewport.y) / viewport.scale,
  };
}

/** Convert world coordinates to screen coordinates. */
export function worldToScreen(
  worldX: number,
  worldY: number,
  viewport: Viewport
): { x: number; y: number } {
  return {
    x: worldX * viewport.scale + viewport.x,
    y: worldY * viewport.scale + viewport.y,
  };
}

/** Clamp zoom scale to allowed range. */
export function clampScale(scale: number): number {
  return Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, scale));
}

/**
 * Zoom toward a fixed screen point so that world point under cursor stays put.
 */
export function zoomAtPoint(
  viewport: Viewport,
  screenX: number,
  screenY: number,
  newScale: number
): Viewport {
  const scale = clampScale(newScale);
  const world = screenToWorld(screenX, screenY, viewport);
  return {
    scale,
    x: screenX - world.x * scale,
    y: screenY - world.y * scale,
  };
}

/**
 * Fit image into the stage with padding. Origin remains top-left of image.
 */
export function fitViewportToImage(
  stageWidth: number,
  stageHeight: number,
  imageWidth: number,
  imageHeight: number,
  padding = 40
): Viewport {
  if (imageWidth <= 0 || imageHeight <= 0 || stageWidth <= 0 || stageHeight <= 0) {
    return { x: 0, y: 0, scale: 1 };
  }

  const availableW = stageWidth - padding * 2;
  const availableH = stageHeight - padding * 2;
  const scale = clampScale(
    Math.min(availableW / imageWidth, availableH / imageHeight, 1)
  );

  const x = (stageWidth - imageWidth * scale) / 2;
  const y = (stageHeight - imageHeight * scale) / 2;

  return { x, y, scale };
}

/** Axis-aligned bounding box hit test for multi-select. */
export function isPointInRect(
  px: number,
  py: number,
  rx: number,
  ry: number,
  rw: number,
  rh: number
): boolean {
  const minX = Math.min(rx, rx + rw);
  const maxX = Math.max(rx, rx + rw);
  const minY = Math.min(ry, ry + rh);
  const maxY = Math.max(ry, ry + rh);
  return px >= minX && px <= maxX && py >= minY && py <= maxY;
}

/**
 * Angle of the edge for arrow rendering (radians).
 */
export function edgeAngle(
  x1: number,
  y1: number,
  x2: number,
  y2: number
): number {
  return Math.atan2(y2 - y1, x2 - x1);
}

/**
 * Shorten an edge so it ends at the node circle edge (visual polish).
 */
export function edgeEndpointsWithPadding(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  padStart: number,
  padEnd: number
): { x1: number; y1: number; x2: number; y2: number } {
  const dist = euclideanDistance(x1, y1, x2, y2);
  if (dist < 0.001) {
    return { x1, y1, x2, y2 };
  }
  const ux = (x2 - x1) / dist;
  const uy = (y2 - y1) / dist;
  return {
    x1: x1 + ux * padStart,
    y1: y1 + uy * padStart,
    x2: x2 - ux * padEnd,
    y2: y2 - uy * padEnd,
  };
}
