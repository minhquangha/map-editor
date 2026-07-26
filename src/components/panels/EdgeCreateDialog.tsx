import {
  Alert,
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
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
import type { EdgeType } from '@/models/types';
import { useEditorStore } from '@/store/useEditorStore';
import { buildNodeIndex } from '@/services/navigationService';
import { DEFAULT_EDGE_WEIGHT, EDGE_TYPE_OPTIONS } from '@/utils/constants';

/**
 * Confirmation step of the edge creation workflow.
 *
 * Opens once both endpoints are picked — which may be on different floors or
 * buildings — and nothing is written to the graph until Create is pressed.
 */
export function EdgeCreateDialog() {
  const pendingEdge = useEditorStore((s) => s.pendingEdge);
  const project = useEditorStore((s) => s.project);
  const confirmPendingEdge = useEditorStore((s) => s.confirmPendingEdge);
  const cancelPendingEdge = useEditorStore((s) => s.cancelPendingEdge);

  const [edgeType, setEdgeType] = useState<EdgeType>('NORMAL');
  const [weight, setWeight] = useState(String(DEFAULT_EDGE_WEIGHT));
  const [bidirectional, setBidirectional] = useState(true);

  const endpoints = useMemo(() => {
    if (!pendingEdge) return null;
    const index = buildNodeIndex(project);
    const from = index.get(pendingEdge.fromId);
    const to = index.get(pendingEdge.toId);
    return from && to ? { from, to } : null;
  }, [pendingEdge, project]);

  const crossFloor =
    endpoints !== null && endpoints.from.floor.id !== endpoints.to.floor.id;
  const crossBuilding =
    endpoints !== null &&
    endpoints.from.building.id !== endpoints.to.building.id;

  // Seed the form each time the dialog opens, inferring a sensible type from
  // the node types the user actually connected.
  useEffect(() => {
    if (!pendingEdge || !endpoints) return;
    const a = endpoints.from.node.type;
    const b = endpoints.to.node.type;
    const inferred: EdgeType =
      a === 'ELEVATOR' && b === 'ELEVATOR'
        ? 'ELEVATOR'
        : a === 'STAIR' && b === 'STAIR'
          ? 'STAIR'
          : 'NORMAL';
    setEdgeType(inferred);
    setWeight(String(DEFAULT_EDGE_WEIGHT));
    setBidirectional(true);
    // Only re-seed when the staged pair changes, not on every project edit.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingEdge?.fromId, pendingEdge?.toId]);

  const weightValue = Number(weight);
  const weightValid = Number.isFinite(weightValue) && weightValue >= 0;

  const handleCreate = () => {
    if (!weightValid) return;
    confirmPendingEdge({ edgeType, weight: weightValue, bidirectional });
  };

  return (
    <Dialog
      open={Boolean(pendingEdge)}
      onClose={cancelPendingEdge}
      maxWidth="xs"
      fullWidth
    >
      <DialogTitle sx={{ pb: 1 }}>
        New Edge
        <Typography variant="caption" color="text.secondary" display="block">
          {crossBuilding
            ? 'Connects two buildings'
            : crossFloor
              ? 'Connects two floors'
              : 'Same-floor connection'}
        </Typography>
      </DialogTitle>

      <DialogContent dividers>
        <Stack spacing={1.5}>
          {endpoints && (
            <Box sx={{ fontSize: 13 }}>
              <EndpointRow
                caption="From"
                label={endpoints.from.node.label || endpoints.from.node.id}
                where={`${endpoints.from.building.name} · ${endpoints.from.floor.name}`}
              />
              <EndpointRow
                caption="To"
                label={endpoints.to.node.label || endpoints.to.node.id}
                where={`${endpoints.to.building.name} · ${endpoints.to.floor.name}`}
              />
            </Box>
          )}

          {crossFloor && (
            <Alert severity="info" sx={{ py: 0 }}>
              Cross-floor edges are not drawn on the canvas. Both nodes get a
              connection badge instead.
            </Alert>
          )}

          <FormControl size="small" fullWidth>
            <InputLabel>Edge Type</InputLabel>
            <Select
              label="Edge Type"
              value={edgeType}
              onChange={(e) => setEdgeType(e.target.value as EdgeType)}
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
            size="small"
            value={weight}
            onChange={(e) => setWeight(e.target.value)}
            error={!weightValid}
            helperText={
              weightValid
                ? 'Routing cost. Distance in pixels is tracked separately.'
                : 'Enter a number of 0 or more.'
            }
            onKeyDown={(e) => {
              if (e.key === 'Enter' && weightValid) handleCreate();
            }}
          />

          <FormControlLabel
            control={
              <Switch
                checked={bidirectional}
                onChange={(e) => setBidirectional(e.target.checked)}
              />
            }
            label={bidirectional ? 'Bidirectional' : 'One-way'}
          />
        </Stack>
      </DialogContent>

      <DialogActions>
        <Button onClick={cancelPendingEdge} color="inherit">
          Cancel
        </Button>
        <Button onClick={handleCreate} variant="contained" disabled={!weightValid}>
          Create Edge
        </Button>
      </DialogActions>
    </Dialog>
  );
}

function EndpointRow({
  caption,
  label,
  where,
}: {
  caption: string;
  label: string;
  where: string;
}) {
  return (
    <Stack direction="row" spacing={1} alignItems="baseline" sx={{ mb: 0.5 }}>
      <Typography
        variant="caption"
        color="text.secondary"
        sx={{ minWidth: 34 }}
      >
        {caption}
      </Typography>
      <Box sx={{ minWidth: 0 }}>
        <Typography variant="body2" noWrap sx={{ fontWeight: 600 }}>
          {label}
        </Typography>
        <Typography variant="caption" color="text.secondary" noWrap>
          {where}
        </Typography>
      </Box>
    </Stack>
  );
}
