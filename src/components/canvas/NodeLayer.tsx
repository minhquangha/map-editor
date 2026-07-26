import { memo, useCallback, useRef } from 'react';
import { Circle, Group, Text } from 'react-konva';
import type Konva from 'konva';
import type { GraphNode } from '@/models/types';
import {
  HOVER_COLOR,
  NODE_COLORS,
  NODE_RADIUS,
  SELECTION_COLOR,
} from '@/utils/constants';

interface NodeLayerProps {
  nodes: GraphNode[];
  selectedNodeIds: Set<string>;
  showLabels: boolean;
  scale: number;
  draggable: boolean;
  onNodeClick: (nodeId: string, additive: boolean) => void;
  onNodeDragStart: (nodeId: string) => void;
  onNodeDragMove: (nodeId: string, x: number, y: number) => void;
  onNodeDragEnd: () => void;
}

interface NodeShapeProps {
  node: GraphNode;
  selected: boolean;
  showLabel: boolean;
  scale: number;
  draggable: boolean;
  onClick: (nodeId: string, additive: boolean) => void;
  onDragStart: (nodeId: string) => void;
  onDragMove: (nodeId: string, x: number, y: number) => void;
  onDragEnd: () => void;
}

function NodeShape({
  node,
  selected,
  showLabel,
  scale,
  draggable,
  onClick,
  onDragStart,
  onDragMove,
  onDragEnd,
}: NodeShapeProps) {
  const strokeScale = 1 / Math.max(scale, 0.01);
  const color = NODE_COLORS[node.type];
  const radius = NODE_RADIUS;

  return (
    <Group
      x={node.x}
      y={node.y}
      draggable={draggable}
      onClick={(e) => {
        e.cancelBubble = true;
        onClick(node.id, e.evt.ctrlKey || e.evt.metaKey || e.evt.shiftKey);
      }}
      onTap={(e) => {
        e.cancelBubble = true;
        onClick(node.id, false);
      }}
      onDragStart={(e) => {
        e.cancelBubble = true;
        onDragStart(node.id);
      }}
      onDragMove={(e) => {
        e.cancelBubble = true;
        const g = e.target as Konva.Group;
        onDragMove(node.id, g.x(), g.y());
      }}
      onDragEnd={(e) => {
        e.cancelBubble = true;
        onDragEnd();
      }}
    >
      {selected && (
        <Circle
          radius={radius + 4 * strokeScale}
          stroke={SELECTION_COLOR}
          strokeWidth={2 * strokeScale}
          listening={false}
        />
      )}
      <Circle
        radius={radius}
        fill={color}
        stroke={selected ? SELECTION_COLOR : HOVER_COLOR}
        strokeWidth={(selected ? 2 : 1.25) * strokeScale}
        shadowColor="#000"
        shadowBlur={4 * strokeScale}
        shadowOpacity={0.35}
      />
      {/* Type indicator center dot for non-normal */}
      {node.type !== 'NORMAL' && (
        <Circle radius={2.5} fill="#0d1117" listening={false} />
      )}
      {showLabel && (node.label || selected) && (
        <Text
          text={node.label || node.id.slice(0, 8)}
          x={radius + 4 * strokeScale}
          y={-6 * strokeScale}
          fontSize={11 * strokeScale}
          fill="#e6edf3"
          listening={false}
          shadowColor="#000"
          shadowBlur={3}
          shadowOpacity={0.85}
        />
      )}
    </Group>
  );
}

const MemoNodeShape = memo(NodeShape);

function NodeLayerComponent({
  nodes,
  selectedNodeIds,
  showLabels,
  scale,
  draggable,
  onNodeClick,
  onNodeDragStart,
  onNodeDragMove,
  onNodeDragEnd,
}: NodeLayerProps) {
  // Track multi-drag offsets from the primary dragged node
  const dragOriginRef = useRef<{ id: string; x: number; y: number } | null>(null);
  const multiDragCommitted = useRef(false);

  const handleDragStart = useCallback(
    (nodeId: string) => {
      const node = nodes.find((n) => n.id === nodeId);
      if (!node) return;
      dragOriginRef.current = { id: nodeId, x: node.x, y: node.y };
      multiDragCommitted.current = false;
      onNodeDragStart(nodeId);
    },
    [nodes, onNodeDragStart]
  );

  const handleDragMove = useCallback(
    (nodeId: string, x: number, y: number) => {
      onNodeDragMove(nodeId, x, y);
    },
    [onNodeDragMove]
  );

  const handleDragEnd = useCallback(() => {
    dragOriginRef.current = null;
    multiDragCommitted.current = false;
    onNodeDragEnd();
  }, [onNodeDragEnd]);

  return (
    <Group>
      {nodes.map((node) => (
        <MemoNodeShape
          key={node.id}
          node={node}
          selected={selectedNodeIds.has(node.id)}
          showLabel={showLabels}
          scale={scale}
          draggable={draggable}
          onClick={onNodeClick}
          onDragStart={handleDragStart}
          onDragMove={handleDragMove}
          onDragEnd={handleDragEnd}
        />
      ))}
    </Group>
  );
}

export const NodeLayer = memo(NodeLayerComponent);
