import {
  Alert,
  Box,
  Divider,
  FormControl,
  FormControlLabel,
  IconButton,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  Switch,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import MyLocationIcon from '@mui/icons-material/MyLocation';
import { useEffect, useMemo, useState } from 'react';
import { useEditorStore } from '@/store/useEditorStore';
import type {
  CustomPropertySchema,
  CustomPropertyType,
  EdgeType,
  Floor,
  GraphEdge,
  GraphNode,
  NodeLocation,
  NodeType,
} from '@/models/types';
import { validateNodeId } from '@/services/graphService';
import { getActiveFloor } from '@/services/projectService';
import {
  buildNodeIndex,
  collectNodeIds,
} from '@/services/navigationService';
import { EDGE_TYPE_OPTIONS, NODE_TYPE_OPTIONS } from '@/utils/constants';
import { ConnectionsSection } from './ConnectionsSection';
import { CustomPropertiesSection } from './CustomPropertiesSection';
import { MetadataEditor } from './MetadataEditor';

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
    () => getActiveFloor(project),
    [project]
  );

  const selectedNodes = useMemo(
    () => floor.nodes.filter((n) => selection.nodeIds.includes(n.id)),
    [floor.nodes, selection.nodeIds]
  );

  // Edges live on the project, so a selected edge may reach off this floor.
  const selectedEdges = useMemo(
    () => project.edges.filter((e) => selection.edgeIds.includes(e.id)),
    [project.edges, selection.edgeIds]
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
    return <EdgeProperties edge={selectedEdges[0]} />;
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
        automatically when endpoints move. <strong>Weight</strong> is the
        routing cost and is only ever what you set it to.
      </Typography>
      <Typography variant="caption" color="text.secondary" component="div" sx={{ mt: 1 }}>
        Edges may connect nodes on <strong>different floors</strong>. Those are
        not drawn on the canvas — the connected nodes carry a ⇅ badge, and the
        node's <strong>Connections</strong> list jumps to the far end.
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
  const project = useEditorStore((s) => s.project);
  const allNodeIds = useMemo(() => collectNodeIds(project), [project]);

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
    // Node ids must be unique project-wide — edges address nodes by id alone.
    const validationError = validateNodeId(allNodeIds, next, {
      excludeId: node.id,
    });
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

        <ConnectionsSection nodeId={node.id} />

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

function EdgeProperties({ edge }: { edge: GraphEdge }) {
  const project = useEditorStore((s) => s.project);
  const updateEdge = useEditorStore((s) => s.updateEdge);
  const renameEdgeId = useEditorStore((s) => s.renameEdgeId);
  const goToNode = useEditorStore((s) => s.goToNode);

  const [idDraft, setIdDraft] = useState(edge.id);
  const [idError, setIdError] = useState<string | null>(null);
  const [distance, setDistance] = useState(String(edge.distance));
  const [weight, setWeight] = useState(String(edge.weight));

  const endpoints = useMemo(() => {
    const index = buildNodeIndex(project);
    return { from: index.get(edge.from), to: index.get(edge.to) };
  }, [project, edge.from, edge.to]);

  const crossFloor =
    endpoints.from !== undefined &&
    endpoints.to !== undefined &&
    endpoints.from.floor.id !== endpoints.to.floor.id;

  useEffect(() => {
    setIdDraft(edge.id);
    setIdError(null);
    setDistance(String(edge.distance));
    setWeight(String(edge.weight));
  }, [edge.id, edge.distance, edge.weight]);

  const commitId = () => {
    const next = idDraft.trim();
    if (next === edge.id) {
      setIdDraft(edge.id);
      setIdError(null);
      return;
    }
    try {
      renameEdgeId(edge.id, next);
      setIdError(null);
    } catch (err) {
      setIdError(err instanceof Error ? err.message : 'Invalid edge ID');
      setIdDraft(edge.id);
    }
  };

  return (
    <PanelShell title="Edge Properties">
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

        {crossFloor && (
          <Alert severity="info" sx={{ py: 0 }} icon={false}>
            Cross-floor edge — not drawn on the canvas.
          </Alert>
        )}

        <EndpointField
          label="From"
          nodeId={edge.from}
          location={endpoints.from}
          onGo={() => goToNode(edge.from)}
        />
        <EndpointField
          label="To"
          nodeId={edge.to}
          location={endpoints.to}
          onGo={() => goToNode(edge.to)}
        />

        <FormControl size="small" fullWidth>
          <InputLabel>Edge Type</InputLabel>
          <Select
            label="Edge Type"
            value={edge.edgeType}
            onChange={(e) =>
              updateEdge(edge.id, { edgeType: e.target.value as EdgeType })
            }
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

        <TextField
          label="Weight"
          type="number"
          value={weight}
          onChange={(e) => setWeight(e.target.value)}
          onBlur={() => {
            const v = Number(weight);
            if (Number.isFinite(v) && v !== edge.weight) {
              updateEdge(edge.id, { weight: v });
            } else {
              setWeight(String(edge.weight));
            }
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
          }}
          size="small"
          helperText="Routing cost used by pathfinding"
        />

        <TextField
          label="Distance (px)"
          type="number"
          value={distance}
          onChange={(e) => setDistance(e.target.value)}
          onBlur={() => {
            const v = Number(distance);
            if (Number.isFinite(v) && v !== edge.distance) {
              updateEdge(edge.id, { distance: v });
            } else {
              setDistance(String(edge.distance));
            }
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
          }}
          size="small"
          disabled={crossFloor}
          helperText={
            crossFloor
              ? 'Not applicable across floors — use Weight'
              : 'Auto-updated when nodes move'
          }
        />

        <FormControlLabel
          control={
            <Switch
              checked={edge.bidirectional}
              onChange={(e) =>
                updateEdge(edge.id, { bidirectional: e.target.checked })
              }
            />
          }
          label={edge.bidirectional ? 'Bidirectional' : 'One-way'}
        />

        <Divider />

        <MetadataEditor
          value={edge.metadata}
          onChange={(metadata) => updateEdge(edge.id, { metadata })}
        />
      </Stack>
    </PanelShell>
  );
}

/** Read-only endpoint with its resolved location and a jump button. */
function EndpointField({
  label,
  nodeId,
  location,
  onGo,
}: {
  label: string;
  nodeId: string;
  location: NodeLocation | undefined;
  onGo: () => void;
}) {
  return (
    <Box>
      <Stack direction="row" spacing={1} alignItems="flex-start">
        <TextField
          label={label}
          value={location ? location.node.label || location.node.id : nodeId}
          InputProps={{ readOnly: true }}
          size="small"
          fullWidth
          helperText={
            location
              ? `${location.building.name} · ${location.floor.name}`
              : 'Node not found'
          }
        />
        <Tooltip title={`Go to ${label.toLowerCase()} node`}>
          <span>
            <IconButton
              size="small"
              onClick={onGo}
              disabled={!location}
              sx={{ mt: 0.5 }}
            >
              <MyLocationIcon fontSize="small" />
            </IconButton>
          </span>
        </Tooltip>
      </Stack>
    </Box>
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
