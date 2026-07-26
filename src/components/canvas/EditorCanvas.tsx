import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { Stage, Layer, Group } from 'react-konva';
import type Konva from 'konva';
import { useEditorStore, worldHitRadius } from '@/store/useEditorStore';
import { FloorBackground } from './FloorBackground';
import { EdgeLayer } from './EdgeLayer';
import { NodeLayer } from './NodeLayer';
import { SelectionBox } from './SelectionBox';
import {
  findEdgeAt,
  findNodeAt,
  getNodesInRect,
} from '@/services/graphService';
import { getActiveFloor } from '@/services/projectService';
import { screenToWorld, zoomAtPoint } from '@/utils/geometry';
import { WHEEL_ZOOM_SENSITIVITY } from '@/utils/constants';

interface Marquee {
  startX: number;
  startY: number;
  x: number;
  y: number;
  width: number;
  height: number;
  active: boolean;
}

const EMPTY_MARQUEE: Marquee = {
  startX: 0,
  startY: 0,
  x: 0,
  y: 0,
  width: 0,
  height: 0,
  active: false,
};

/**
 * Main infinite canvas for digitizing floor plans.
 * Handles zoom, pan, node/edge tools, marquee multi-select, and drag-move.
 */
export function EditorCanvas() {
  const containerRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<Konva.Stage>(null);

  const project = useEditorStore((s) => s.project);
  const tool = useEditorStore((s) => s.tool);
  const viewport = useEditorStore((s) => s.viewport);
  const stageSize = useEditorStore((s) => s.stageSize);
  const selection = useEditorStore((s) => s.selection);
  const showNodeLabels = useEditorStore((s) => s.showNodeLabels);
  const showDistances = useEditorStore((s) => s.showDistances);
  const edgeDraftFromId = useEditorStore((s) => s.edgeDraftFromId);

  const setViewport = useEditorStore((s) => s.setViewport);
  const setStageSize = useEditorStore((s) => s.setStageSize);
  const setIsPanning = useEditorStore((s) => s.setIsPanning);
  const selectNodes = useEditorStore((s) => s.selectNodes);
  const selectEdges = useEditorStore((s) => s.selectEdges);
  const clearSelection = useEditorStore((s) => s.clearSelection);
  const addNodeAt = useEditorStore((s) => s.addNodeAt);
  const connectEdge = useEditorStore((s) => s.connectEdge);
  const setEdgeDraftFromId = useEditorStore((s) => s.setEdgeDraftFromId);
  const deleteSelection = useEditorStore((s) => s.deleteSelection);
  const commitHistory = useEditorStore((s) => s.commitHistory);
  const moveNodesLive = useEditorStore((s) => s.moveNodesLive);
  const setStatus = useEditorStore((s) => s.setStatus);

  const floor = useMemo(() => getActiveFloor(project), [project]);

  const selectedNodeIds = useMemo(
    () => new Set(selection.nodeIds),
    [selection.nodeIds]
  );
  const selectedEdgeIds = useMemo(
    () => new Set(selection.edgeIds),
    [selection.edgeIds]
  );

  const [marquee, setMarquee] = useState<Marquee>(EMPTY_MARQUEE);
  const [cursorWorld, setCursorWorld] = useState<{ x: number; y: number } | null>(
    null
  );
  const [spacePan, setSpacePan] = useState(false);

  const panRef = useRef<{
    active: boolean;
    lastX: number;
    lastY: number;
  }>({ active: false, lastX: 0, lastY: 0 });

  const dragStateRef = useRef<{
    primaryId: string;
    lastX: number;
    lastY: number;
    ids: string[];
  } | null>(null);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const ro = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (!entry) return;
      const { width, height } = entry.contentRect;
      if (width > 0 && height > 0) {
        setStageSize(width, height);
      }
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [setStageSize]);

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.code === 'Space' && !e.repeat) {
        const t = e.target as HTMLElement;
        if (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA') return;
        e.preventDefault();
        setSpacePan(true);
      }
    };
    const up = (e: KeyboardEvent) => {
      if (e.code === 'Space') setSpacePan(false);
    };
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    return () => {
      window.removeEventListener('keydown', down);
      window.removeEventListener('keyup', up);
    };
  }, []);

  const isPanMode = tool === 'pan' || spacePan;

  const getPointerWorld = useCallback((): { x: number; y: number } | null => {
    const stage = stageRef.current;
    if (!stage) return null;
    const pos = stage.getPointerPosition();
    if (!pos) return null;
    return screenToWorld(pos.x, pos.y, useEditorStore.getState().viewport);
  }, []);

  const onWheel = useCallback(
    (e: Konva.KonvaEventObject<WheelEvent>) => {
      e.evt.preventDefault();
      const stage = stageRef.current;
      if (!stage) return;

      const pointer = stage.getPointerPosition();
      if (!pointer) return;

      // Mouse wheel zoom and Ctrl+wheel zoom (both supported)
      const vp = useEditorStore.getState().viewport;
      const delta = -e.evt.deltaY;
      const factor = Math.exp(delta * WHEEL_ZOOM_SENSITIVITY);
      setViewport(zoomAtPoint(vp, pointer.x, pointer.y, vp.scale * factor));
    },
    [setViewport]
  );

  const onStageMouseDown = useCallback(
    (e: Konva.KonvaEventObject<MouseEvent>) => {
      const isMiddle = e.evt.button === 1;
      const isLeft = e.evt.button === 0;

      if (isMiddle || (isLeft && isPanMode)) {
        panRef.current = {
          active: true,
          lastX: e.evt.clientX,
          lastY: e.evt.clientY,
        };
        setIsPanning(true);
        e.evt.preventDefault();
        return;
      }

      if (!isLeft) return;

      const targetClass = e.target.getClassName();
      const clickedOnEmpty =
        e.target === e.target.getStage() ||
        targetClass === 'Image' ||
        targetClass === 'Rect' ||
        e.target.name() === 'world-bg';

      // Node/edge shapes handle their own clicks
      if (!clickedOnEmpty && targetClass === 'Circle') {
        return;
      }
      if (!clickedOnEmpty && targetClass === 'Group') {
        // Might be a node group — let it bubble from NodeLayer
        const parent = e.target.getParent();
        if (parent && parent.getClassName() === 'Group') {
          return;
        }
      }
      if (targetClass === 'Line' || targetClass === 'Arrow') {
        return;
      }

      const world = getPointerWorld();
      if (!world) return;

      const currentTool = useEditorStore.getState().tool;
      const currentFloor = useEditorStore.getState().getActiveFloor();
      const hitR = worldHitRadius(useEditorStore.getState().viewport.scale);

      if (currentTool === 'add-node') {
        addNodeAt(world.x, world.y);
        return;
      }

      if (currentTool === 'add-edge') {
        const node = findNodeAt(currentFloor, world.x, world.y, hitR);
        if (node) {
          const draft = useEditorStore.getState().edgeDraftFromId;
          if (!draft) {
            setEdgeDraftFromId(node.id);
            selectNodes([node.id]);
            setStatus({
              message: 'Select the second node to connect',
              severity: 'info',
            });
          } else if (draft !== node.id) {
            connectEdge(draft, node.id);
          }
        } else {
          setEdgeDraftFromId(null);
        }
        return;
      }

      if (currentTool === 'delete') {
        const node = findNodeAt(currentFloor, world.x, world.y, hitR);
        if (node) {
          selectNodes([node.id]);
          requestAnimationFrame(() => deleteSelection());
          return;
        }
        const edge = findEdgeAt(currentFloor, world.x, world.y, hitR);
        if (edge) {
          selectEdges([edge.id]);
          requestAnimationFrame(() => deleteSelection());
          return;
        }
        return;
      }

      if (currentTool === 'pointer') {
        const node = findNodeAt(currentFloor, world.x, world.y, hitR);
        if (node) return;

        const edge = findEdgeAt(currentFloor, world.x, world.y, hitR);
        if (edge) {
          selectEdges(
            [edge.id],
            e.evt.ctrlKey || e.evt.metaKey || e.evt.shiftKey
          );
          return;
        }

        if (!(e.evt.ctrlKey || e.evt.metaKey || e.evt.shiftKey)) {
          clearSelection();
        }

        setMarquee({
          startX: world.x,
          startY: world.y,
          x: world.x,
          y: world.y,
          width: 0,
          height: 0,
          active: true,
        });
      }
    },
    [
      isPanMode,
      setIsPanning,
      getPointerWorld,
      addNodeAt,
      setEdgeDraftFromId,
      selectNodes,
      selectEdges,
      connectEdge,
      setStatus,
      deleteSelection,
      clearSelection,
    ]
  );

  const onStageMouseMove = useCallback(
    (e: Konva.KonvaEventObject<MouseEvent>) => {
      if (panRef.current.active) {
        const dx = e.evt.clientX - panRef.current.lastX;
        const dy = e.evt.clientY - panRef.current.lastY;
        panRef.current.lastX = e.evt.clientX;
        panRef.current.lastY = e.evt.clientY;
        const vp = useEditorStore.getState().viewport;
        setViewport({ ...vp, x: vp.x + dx, y: vp.y + dy });
        return;
      }

      const world = getPointerWorld();
      if (!world) return;
      setCursorWorld(world);

      if (marquee.active) {
        setMarquee((m) => ({
          ...m,
          x: Math.min(m.startX, world.x),
          y: Math.min(m.startY, world.y),
          width: Math.abs(world.x - m.startX),
          height: Math.abs(world.y - m.startY),
        }));
      }
    },
    [getPointerWorld, marquee.active, setViewport]
  );

  const onStageMouseUp = useCallback(
    (e: Konva.KonvaEventObject<MouseEvent>) => {
      if (panRef.current.active) {
        panRef.current.active = false;
        setIsPanning(false);
        return;
      }

      if (marquee.active) {
        const floorNow = useEditorStore.getState().getActiveFloor();
        const nodes = getNodesInRect(
          floorNow,
          marquee.x,
          marquee.y,
          marquee.width,
          marquee.height
        );
        if (nodes.length > 0) {
          selectNodes(
            nodes.map((n) => n.id),
            e.evt.ctrlKey || e.evt.metaKey || e.evt.shiftKey
          );
        }
        setMarquee(EMPTY_MARQUEE);
      }
    },
    [marquee, setIsPanning, selectNodes]
  );

  const onNodeClick = useCallback(
    (nodeId: string, additive: boolean) => {
      const currentTool = useEditorStore.getState().tool;

      if (currentTool === 'add-edge') {
        const draft = useEditorStore.getState().edgeDraftFromId;
        if (!draft) {
          setEdgeDraftFromId(nodeId);
          selectNodes([nodeId]);
          setStatus({
            message: 'Select the second node to connect',
            severity: 'info',
          });
        } else if (draft !== nodeId) {
          connectEdge(draft, nodeId);
        }
        return;
      }

      if (currentTool === 'delete') {
        selectNodes([nodeId]);
        requestAnimationFrame(() => deleteSelection());
        return;
      }

      if (currentTool === 'add-node') return;

      selectNodes([nodeId], additive);
    },
    [setEdgeDraftFromId, selectNodes, setStatus, connectEdge, deleteSelection]
  );

  const onEdgeClick = useCallback(
    (edgeId: string, additive: boolean) => {
      const currentTool = useEditorStore.getState().tool;
      if (currentTool === 'delete') {
        selectEdges([edgeId]);
        requestAnimationFrame(() => deleteSelection());
        return;
      }
      if (currentTool === 'add-node' || currentTool === 'add-edge') return;
      selectEdges([edgeId], additive);
    },
    [selectEdges, deleteSelection]
  );

  const onNodeDragStart = useCallback(
    (nodeId: string) => {
      const state = useEditorStore.getState();
      let ids = state.selection.nodeIds;
      if (!ids.includes(nodeId)) {
        ids = [nodeId];
        selectNodes([nodeId]);
      }
      const node = state.getActiveFloor().nodes.find((n) => n.id === nodeId);
      if (!node) return;

      commitHistory();
      dragStateRef.current = {
        primaryId: nodeId,
        lastX: node.x,
        lastY: node.y,
        ids,
      };
    },
    [selectNodes, commitHistory]
  );

  const onNodeDragMove = useCallback(
    (nodeId: string, x: number, y: number) => {
      const drag = dragStateRef.current;
      if (!drag || drag.primaryId !== nodeId) {
        const floorNow = useEditorStore.getState().getActiveFloor();
        const node = floorNow.nodes.find((n) => n.id === nodeId);
        if (!node) return;
        const dx = x - node.x;
        const dy = y - node.y;
        if (dx === 0 && dy === 0) return;
        moveNodesLive([nodeId], dx, dy);
        return;
      }

      const dx = x - drag.lastX;
      const dy = y - drag.lastY;
      if (dx === 0 && dy === 0) return;

      moveNodesLive(drag.ids, dx, dy);
      drag.lastX = x;
      drag.lastY = y;
    },
    [moveNodesLive]
  );

  const onNodeDragEnd = useCallback(() => {
    dragStateRef.current = null;
  }, []);

  const cursor = panRef.current.active || isPanMode
    ? 'grab'
    : tool === 'add-node'
      ? 'crosshair'
      : tool === 'add-edge'
        ? 'cell'
        : tool === 'delete'
          ? 'not-allowed'
          : 'default';

  const preview =
    edgeDraftFromId && cursorWorld
      ? { fromId: edgeDraftFromId, toX: cursorWorld.x, toY: cursorWorld.y }
      : null;

  const nodesDraggable = tool === 'pointer';

  return (
    <div
      ref={containerRef}
      style={{
        width: '100%',
        height: '100%',
        overflow: 'hidden',
        background:
          'radial-gradient(circle at 1px 1px, #21262d 1px, #0d1117 0)',
        backgroundSize: '24px 24px',
        cursor,
      }}
    >
      <Stage
        ref={stageRef}
        width={stageSize.width}
        height={stageSize.height}
        onWheel={onWheel}
        onMouseDown={onStageMouseDown}
        onMouseMove={onStageMouseMove}
        onMouseUp={onStageMouseUp}
        onMouseLeave={() => {
          if (panRef.current.active) {
            panRef.current.active = false;
            setIsPanning(false);
          }
        }}
        onContextMenu={(e) => e.evt.preventDefault()}
      >
        <Layer
          x={viewport.x}
          y={viewport.y}
          scaleX={viewport.scale}
          scaleY={viewport.scale}
        >
          <Group name="world-bg">
            <FloorBackground
              dataUrl={floor.imageDataUrl}
              width={floor.imageWidth}
              height={floor.imageHeight}
            />
          </Group>

          <EdgeLayer
            nodes={floor.nodes}
            edges={floor.edges}
            selectedEdgeIds={selectedEdgeIds}
            showDistances={showDistances}
            scale={viewport.scale}
            preview={preview}
            onEdgeClick={onEdgeClick}
          />

          <NodeLayer
            nodes={floor.nodes}
            selectedNodeIds={selectedNodeIds}
            showLabels={showNodeLabels}
            scale={viewport.scale}
            draggable={nodesDraggable}
            onNodeClick={onNodeClick}
            onNodeDragStart={onNodeDragStart}
            onNodeDragMove={onNodeDragMove}
            onNodeDragEnd={onNodeDragEnd}
          />

          <SelectionBox
            x={marquee.x}
            y={marquee.y}
            width={marquee.width}
            height={marquee.height}
            visible={marquee.active}
          />
        </Layer>
      </Stage>
    </div>
  );
}
