import {
  Box,
  Divider,
  FormControl,
  FormControlLabel,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  Switch,
  TextField,
  Typography,
} from '@mui/material';
import { useEffect, useMemo, useState } from 'react';
import { useEditorStore } from '@/store/useEditorStore';
import type { EdgeType, GraphEdge, GraphNode, NodeType } from '@/models/types';
import { EDGE_TYPE_OPTIONS, NODE_TYPE_OPTIONS } from '@/utils/constants';

export function PropertiesPanel() {
  const project = useEditorStore((s) => s.project);
  const selection = useEditorStore((s) => s.selection);
  const updateNode = useEditorStore((s) => s.updateNode);
  const updateEdge = useEditorStore((s) => s.updateEdge);

  const floor = useMemo(
    () => project.floors.find((f) => f.id === project.activeFloorId)!,
    [project]
  );

  const selectedNodes = useMemo(
    () => floor.nodes.filter((n) => selection.nodeIds.includes(n.id)),
    [floor.nodes, selection.nodeIds]
  );

  const selectedEdges = useMemo(
    () => floor.edges.filter((e) => selection.edgeIds.includes(e.id)),
    [floor.edges, selection.edgeIds]
  );

  if (selectedNodes.length === 1 && selectedEdges.length === 0) {
    return (
      <NodeProperties
        node={selectedNodes[0]}
        onUpdate={(patch) => updateNode(selectedNodes[0].id, patch)}
      />
    );
  }

  if (selectedEdges.length === 1 && selectedNodes.length === 0) {
    return (
      <EdgeProperties
        edge={selectedEdges[0]}
        floorNodes={floor.nodes}
        onUpdate={(patch) => updateEdge(selectedEdges[0].id, patch)}
      />
    );
  }

  if (selectedNodes.length > 1) {
    return (
      <PanelShell title="Selection">
        <Typography variant="body2" color="text.secondary">
          {selectedNodes.length} nodes selected
        </Typography>
        <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
          Drag to move together. Delete removes all selected nodes and their edges.
        </Typography>
      </PanelShell>
    );
  }

  if (selectedEdges.length > 1) {
    return (
      <PanelShell title="Selection">
        <Typography variant="body2" color="text.secondary">
          {selectedEdges.length} edges selected
        </Typography>
      </PanelShell>
    );
  }

  return (
    <PanelShell title="Properties">
      <Typography variant="body2" color="text.secondary">
        Select a node or edge to edit its properties.
      </Typography>
      <Divider sx={{ my: 1.5 }} />
      <Typography variant="caption" color="text.secondary" component="div">
        <strong>Coordinates</strong> are image pixels with origin (0,0) at the top-left of the
        floor plan.
      </Typography>
      <Typography variant="caption" color="text.secondary" component="div" sx={{ mt: 1 }}>
        <strong>Distance</strong> is Euclidean length in pixels and updates automatically when
        endpoints move.
      </Typography>
    </PanelShell>
  );
}

function NodeProperties({
  node,
  onUpdate,
}: {
  node: GraphNode;
  onUpdate: (patch: Partial<{ x: number; y: number; label: string; type: NodeType }>) => void;
}) {
  const [label, setLabel] = useState(node.label);
  const [x, setX] = useState(String(node.x));
  const [y, setY] = useState(String(node.y));

  useEffect(() => {
    setLabel(node.label);
    setX(String(node.x));
    setY(String(node.y));
  }, [node.id, node.label, node.x, node.y]);

  return (
    <PanelShell title="Node Properties">
      <Stack spacing={1.5}>
        <TextField label="ID" value={node.id} InputProps={{ readOnly: true }} size="small" />
        <TextField
          label="Floor"
          value={node.floor}
          InputProps={{ readOnly: true }}
          size="small"
        />
        <Stack direction="row" spacing={1}>
          <TextField
            label="X"
            type="number"
            value={x}
            onChange={(e) => setX(e.target.value)}
            onBlur={() => {
              const v = Number(x);
              if (Number.isFinite(v) && v !== node.x) onUpdate({ x: v });
              else setX(String(node.x));
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
            }}
            size="small"
          />
          <TextField
            label="Y"
            type="number"
            value={y}
            onChange={(e) => setY(e.target.value)}
            onBlur={() => {
              const v = Number(y);
              if (Number.isFinite(v) && v !== node.y) onUpdate({ y: v });
              else setY(String(node.y));
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
            }}
            size="small"
          />
        </Stack>
        <TextField
          label="Label"
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          onBlur={() => {
            if (label !== node.label) onUpdate({ label });
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
          }}
          size="small"
          placeholder="Room name / code"
        />
        <FormControl size="small" fullWidth>
          <InputLabel>Type</InputLabel>
          <Select
            label="Type"
            value={node.type}
            onChange={(e) => onUpdate({ type: e.target.value as NodeType })}
          >
            {NODE_TYPE_OPTIONS.map((opt) => (
              <MenuItem key={opt.value} value={opt.value}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Box
                    sx={{
                      width: 10,
                      height: 10,
                      borderRadius: '50%',
                      bgcolor: opt.color,
                    }}
                  />
                  {opt.label}
                </Box>
              </MenuItem>
            ))}
          </Select>
        </FormControl>
      </Stack>
    </PanelShell>
  );
}

function EdgeProperties({
  edge,
  floorNodes,
  onUpdate,
}: {
  edge: GraphEdge;
  floorNodes: GraphNode[];
  onUpdate: (
    patch: Partial<{ edgeType: EdgeType; bidirectional: boolean; distance: number }>
  ) => void;
}) {
  const fromNode = floorNodes.find((n) => n.id === edge.from);
  const toNode = floorNodes.find((n) => n.id === edge.to);
  const [distance, setDistance] = useState(String(edge.distance));

  useEffect(() => {
    setDistance(String(edge.distance));
  }, [edge.id, edge.distance]);

  return (
    <PanelShell title="Edge Properties">
      <Stack spacing={1.5}>
        <TextField
          label="From"
          value={fromNode?.label || edge.from}
          InputProps={{ readOnly: true }}
          size="small"
          helperText={edge.from}
        />
        <TextField
          label="To"
          value={toNode?.label || edge.to}
          InputProps={{ readOnly: true }}
          size="small"
          helperText={edge.to}
        />
        <TextField
          label="Distance (px)"
          type="number"
          value={distance}
          onChange={(e) => setDistance(e.target.value)}
          onBlur={() => {
            const v = Number(distance);
            if (Number.isFinite(v) && v !== edge.distance) onUpdate({ distance: v });
            else setDistance(String(edge.distance));
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
          }}
          size="small"
          helperText="Auto-updated when nodes move"
        />
        <FormControl size="small" fullWidth>
          <InputLabel>Edge Type</InputLabel>
          <Select
            label="Edge Type"
            value={edge.edgeType}
            onChange={(e) => onUpdate({ edgeType: e.target.value as EdgeType })}
          >
            {EDGE_TYPE_OPTIONS.map((opt) => (
              <MenuItem key={opt.value} value={opt.value}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Box
                    sx={{
                      width: 14,
                      height: 3,
                      bgcolor: opt.color,
                      borderRadius: 1,
                    }}
                  />
                  {opt.label}
                </Box>
              </MenuItem>
            ))}
          </Select>
        </FormControl>
        <FormControlLabel
          control={
            <Switch
              checked={edge.bidirectional}
              onChange={(e) => onUpdate({ bidirectional: e.target.checked })}
            />
          }
          label={edge.bidirectional ? 'Bidirectional' : 'One-way'}
        />
      </Stack>
    </PanelShell>
  );
}

function PanelShell({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <Box sx={{ p: 1.5, height: '100%', overflow: 'auto' }}>
      <Typography
        variant="overline"
        color="text.secondary"
        sx={{ letterSpacing: 1, display: 'block', mb: 1.5 }}
      >
        {title}
      </Typography>
      {children}
    </Box>
  );
}
