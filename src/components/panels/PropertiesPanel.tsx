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
import type {
  CustomPropertySchema,
  CustomPropertyType,
  EdgeType,
  Floor,
  GraphEdge,
  GraphNode,
  NodeType,
} from '@/models/types';
import { validateNodeId } from '@/services/graphService';
import { EDGE_TYPE_OPTIONS, NODE_TYPE_OPTIONS } from '@/utils/constants';
import { CustomPropertiesSection } from './CustomPropertiesSection';

export function PropertiesPanel() {
  const project = useEditorStore((s) => s.project);
  const selection = useEditorStore((s) => s.selection);
  const updateNode = useEditorStore((s) => s.updateNode);
  const renameNodeId = useEditorStore((s) => s.renameNodeId);
  const updateEdge = useEditorStore((s) => s.updateEdge);
  const addNodeProperty = useEditorStore((s) => s.addNodeProperty);
  const renameNodeProperty = useEditorStore((s) => s.renameNodeProperty);
  const deleteNodeProperty = useEditorStore((s) => s.deleteNodeProperty);
  const setNodePropertyValue = useEditorStore((s) => s.setNodePropertyValue);
  const setNodePropertySchema = useEditorStore((s) => s.setNodePropertySchema);

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
    const node = selectedNodes[0];
    return (
      <NodeProperties
        node={node}
        floor={floor}
        onUpdate={(patch) => updateNode(node.id, patch)}
        onRenameId={(newId) => renameNodeId(node.id, newId)}
        onAddProperty={(key, type, options) =>
          addNodeProperty(node.id, key, type, options)
        }
        onRenameProperty={(oldKey, newKey) =>
          renameNodeProperty(node.id, oldKey, newKey)
        }
        onDeleteProperty={(key) => deleteNodeProperty(node.id, key)}
        onPropertyValue={(key, value) =>
          setNodePropertyValue(node.id, key, value)
        }
        onPropertySchema={(key, schema) =>
          setNodePropertySchema(node.id, key, schema)
        }
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
        <strong>Coordinates</strong> are image pixels with origin (0,0) at the
        top-left of the floor plan.
      </Typography>
      <Typography variant="caption" color="text.secondary" component="div" sx={{ mt: 1 }}>
        <strong>Distance</strong> is Euclidean length in pixels and updates
        automatically when endpoints move.
      </Typography>
      <Typography variant="caption" color="text.secondary" component="div" sx={{ mt: 1 }}>
        Nodes support unlimited <strong>custom properties</strong> (string,
        number, boolean, enum, array) that export with the graph JSON.
      </Typography>
    </PanelShell>
  );
}

function NodeProperties({
  node,
  floor,
  onUpdate,
  onRenameId,
  onAddProperty,
  onRenameProperty,
  onDeleteProperty,
  onPropertyValue,
  onPropertySchema,
}: {
  node: GraphNode;
  floor: Floor;
  onUpdate: (
    patch: Partial<{
      x: number;
      y: number;
      label: string;
      type: NodeType;
      room_type: string;
    }>
  ) => void;
  onRenameId: (newId: string) => void;
  onAddProperty: (key: string, type: CustomPropertyType, options?: string[]) => void;
  onRenameProperty: (oldKey: string, newKey: string) => void;
  onDeleteProperty: (key: string) => void;
  onPropertyValue: (key: string, value: unknown) => void;
  onPropertySchema: (key: string, schema: CustomPropertySchema) => void;
}) {
  const [idDraft, setIdDraft] = useState(node.id);
  const [idError, setIdError] = useState<string | null>(null);
  const [label, setLabel] = useState(node.label);
  const [roomType, setRoomType] = useState(node.room_type ?? '');
  const [x, setX] = useState(String(node.x));
  const [y, setY] = useState(String(node.y));

  useEffect(() => {
    setIdDraft(node.id);
    setIdError(null);
    setLabel(node.label);
    setRoomType(node.room_type ?? '');
    setX(String(node.x));
    setY(String(node.y));
  }, [node.id, node.label, node.room_type, node.x, node.y]);

  const commitId = () => {
    const next = idDraft.trim();
    if (next === node.id) {
      setIdDraft(node.id);
      setIdError(null);
      return;
    }
    const validationError = validateNodeId(floor, next, { excludeId: node.id });
    if (validationError) {
      setIdError(validationError);
      setIdDraft(node.id);
      return;
    }
    try {
      onRenameId(next);
      setIdError(null);
    } catch (err) {
      setIdError(err instanceof Error ? err.message : 'Invalid node ID');
      setIdDraft(node.id);
    }
  };

  return (
    <PanelShell title="Node Properties">
      <Stack spacing={1.5}>
        <TextField
          label="ID"
          value={idDraft}
          size="small"
          fullWidth
          error={Boolean(idError)}
          helperText={idError ?? undefined}
          onChange={(e) => {
            setIdDraft(e.target.value);
            if (idError) setIdError(null);
          }}
          onBlur={commitId}
          onKeyDown={(e) => {
            if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
          }}
        />
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
        <TextField
          label="Room Type"
          value={roomType}
          onChange={(e) => setRoomType(e.target.value)}
          onBlur={() => {
            if (roomType !== (node.room_type ?? '')) {
              onUpdate({ room_type: roomType });
            }
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
          }}
          size="small"
          fullWidth
          placeholder="e.g. Blood Test"
        />

        <Divider sx={{ my: 0.5 }} />

        <CustomPropertiesSection
          node={node}
          onAdd={onAddProperty}
          onRename={onRenameProperty}
          onDelete={onDeleteProperty}
          onValueChange={onPropertyValue}
          onSchemaChange={onPropertySchema}
        />
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
