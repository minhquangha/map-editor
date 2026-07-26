import { memo } from 'react';
import { Rect } from 'react-konva';

interface SelectionBoxProps {
  x: number;
  y: number;
  width: number;
  height: number;
  visible: boolean;
}

function SelectionBoxComponent({ x, y, width, height, visible }: SelectionBoxProps) {
  if (!visible) return null;

  return (
    <Rect
      x={x}
      y={y}
      width={width}
      height={height}
      fill="rgba(66, 165, 245, 0.12)"
      stroke="#42a5f5"
      strokeWidth={1}
      dash={[4, 3]}
      listening={false}
    />
  );
}

export const SelectionBox = memo(SelectionBoxComponent);
