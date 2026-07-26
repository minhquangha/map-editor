import { useEffect, useState, memo } from 'react';
import { Image as KonvaImage, Rect, Group } from 'react-konva';

interface FloorBackgroundProps {
  dataUrl: string | null;
  width: number;
  height: number;
}

/**
 * Renders the floor plan image with origin at top-left (0,0).
 * Image is loaded asynchronously and drawn at native pixel size.
 */
function FloorBackgroundComponent({ dataUrl, width, height }: FloorBackgroundProps) {
  const [image, setImage] = useState<HTMLImageElement | null>(null);

  useEffect(() => {
    if (!dataUrl) {
      setImage(null);
      return;
    }

    let cancelled = false;
    const img = new window.Image();
    img.onload = () => {
      if (!cancelled) setImage(img);
    };
    img.onerror = () => {
      if (!cancelled) setImage(null);
    };
    img.src = dataUrl;

    return () => {
      cancelled = true;
    };
  }, [dataUrl]);

  const w = width || image?.naturalWidth || 0;
  const h = height || image?.naturalHeight || 0;

  return (
    <Group listening={false}>
      {/* Subtle canvas paper under the image */}
      {w > 0 && h > 0 && (
        <Rect
          x={0}
          y={0}
          width={w}
          height={h}
          fill="#1a1f27"
          stroke="#30363d"
          strokeWidth={1}
          shadowColor="black"
          shadowBlur={20}
          shadowOpacity={0.35}
          shadowOffset={{ x: 0, y: 4 }}
        />
      )}
      {image && (
        <KonvaImage
          image={image}
          x={0}
          y={0}
          width={w}
          height={h}
          listening={false}
        />
      )}
      {/* Origin marker */}
      <Rect x={-1} y={-1} width={2} height={2} fill="#f85149" listening={false} />
    </Group>
  );
}

export const FloorBackground = memo(FloorBackgroundComponent);
