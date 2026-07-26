import { v4 as uuidv4 } from 'uuid';

/** Generate a short unique id for nodes/edges (readable in JSON). */
export function createId(prefix?: string): string {
  const raw = uuidv4().replace(/-/g, '').slice(0, 12);
  return prefix ? `${prefix}_${raw}` : raw;
}

export function createNodeId(): string {
  return createId('n');
}

export function createEdgeId(): string {
  return createId('e');
}
