import { memo, useMemo } from 'react';
import { Arrow, Group, Line, Text } from 'react-konva';
import type { GraphEdge, GraphNode } from '@/models/types';
import {
  EDGE_COLORS,
  NODE_RADIUS,
  PREVIEW_EDGE_COLOR,
  SELECTION_COLOR,
} from '@/utils/constants';
import { edgeEndpointsWithPadding } from '@/utils/geometry';

interface EdgeLayerProps {
  nodes: GraphNode[];
  edges: GraphEdge[];
  selectedEdgeIds: Set<string>;
  showDistances: boolean;
  scale: number;
  /** Preview while creating an edge (from node → cursor). */
  preview?: { fromId: string; toX: number; toY: number } | null;
  onEdgeClick: (edgeId: string, additive: boolean) => void;
}

function EdgeLayerComponent({
  nodes,
  edges,
  selectedEdgeIds,
  showDistances,
  scale,
  preview,
  onEdgeClick,
}: EdgeLayerProps) {
  const nodeMap = useMemo(() => {
    const map = new Map<string, GraphNode>();
    for (const n of nodes) map.set(n.id, n);
    return map;
  }, [nodes]);

  const strokeScale = 1 / Math.max(scale, 0.01);
  const fontSize = 11 * strokeScale;

  return (
    <Group>
      {edges.map((edge) => {
        const a = nodeMap.get(edge.from);
        const b = nodeMap.get(edge.to);
        if (!a || !b) return null;

        const selected = selectedEdgeIds.has(edge.id);
        const color = selected ? SELECTION_COLOR : EDGE_COLORS[edge.edgeType];
        const pts = edgeEndpointsWithPadding(
          a.x,
          a.y,
          b.x,
          b.y,
          NODE_RADIUS + 2,
          NODE_RADIUS + 2
        );

        const midX = (pts.x1 + pts.x2) / 2;
        const midY = (pts.y1 + pts.y2) / 2;

        return (
          <Group key={edge.id}>
            {/* Wide invisible hit area */}
            <Line
              points={[pts.x1, pts.y1, pts.x2, pts.y2]}
              stroke="transparent"
              strokeWidth={12 * strokeScale}
              hitStrokeWidth={14 * strokeScale}
              onClick={(e) => {
                e.cancelBubble = true;
                onEdgeClick(edge.id, e.evt.ctrlKey || e.evt.metaKey || e.evt.shiftKey);
              }}
              onTap={(e) => {
                e.cancelBubble = true;
                onEdgeClick(edge.id, false);
              }}
            />
            {edge.bidirectional ? (
              <Line
                points={[pts.x1, pts.y1, pts.x2, pts.y2]}
                stroke={color}
                strokeWidth={(selected ? 2.5 : 1.75) * strokeScale}
                lineCap="round"
                listening={false}
              />
            ) : (
              <Arrow
                points={[pts.x1, pts.y1, pts.x2, pts.y2]}
                stroke={color}
                fill={color}
                strokeWidth={(selected ? 2.5 : 1.75) * strokeScale}
                pointerLength={8 * strokeScale}
                pointerWidth={7 * strokeScale}
                lineCap="round"
                listening={false}
              />
            )}
            {showDistances && (
              <Text
                x={midX + 4 * strokeScale}
                y={midY - 12 * strokeScale}
                text={String(Math.round(edge.distance))}
                fontSize={fontSize}
                fill="#c9d1d9"
                listening={false}
                shadowColor="#000"
                shadowBlur={2}
                shadowOpacity={0.8}
              />
            )}
          </Group>
        );
      })}

      {preview && (() => {
        const from = nodeMap.get(preview.fromId);
        if (!from) return null;
        return (
          <Line
            points={[from.x, from.y, preview.toX, preview.toY]}
            stroke={PREVIEW_EDGE_COLOR}
            strokeWidth={2 * strokeScale}
            dash={[8 * strokeScale, 6 * strokeScale]}
            listening={false}
          />
        );
      })()}
    </Group>
  );
}

export const EdgeLayer = memo(EdgeLayerComponent);
