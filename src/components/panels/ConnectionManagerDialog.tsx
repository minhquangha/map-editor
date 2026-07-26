import {
  Box,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Tooltip,
  Typography,
} from '@mui/material';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import LoginIcon from '@mui/icons-material/Login';
import LogoutIcon from '@mui/icons-material/Logout';
import { useMemo } from 'react';
import { useEditorStore } from '@/store/useEditorStore';
import {
  edgeDisplayName,
  labelFor,
  listCrossFloorConnections,
} from '@/services/navigationService';
import { EDGE_COLORS, EDGE_TYPE_OPTIONS } from '@/utils/constants';
import { EdgeProperties } from './PropertiesPanel';

interface ConnectionManagerDialogProps {
  open: boolean;
  onClose: () => void;
}

function typeLabel(value: string): string {
  return EDGE_TYPE_OPTIONS.find((o) => o.value === value)?.label ?? value;
}

/**
 * Central list of every cross-floor connection in the project.
 *
 * Same-floor edges are excluded — those are visible on the canvas already.
 *
 * Everything here reads from and writes to the store, so the table reflects
 * edits made anywhere in the editor and edits made here land on the canvas
 * immediately. Editing reuses `EdgeProperties`, the same component the
 * right-hand dock renders.
 */
export function ConnectionManagerDialog({
  open,
  onClose,
}: ConnectionManagerDialogProps) {
  const project = useEditorStore((s) => s.project);
  const selection = useEditorStore((s) => s.selection);
  const selectEdges = useEditorStore((s) => s.selectEdges);
  const deleteEdges = useEditorStore((s) => s.deleteEdges);
  const goToNode = useEditorStore((s) => s.goToNode);

  const connections = useMemo(
    () => listCrossFloorConnections(project),
    [project]
  );

  // Selection is shared with the canvas, so a row stays highlighted when the
  // same edge is picked elsewhere.
  const selectedEdgeId =
    selection.edgeIds.length === 1 ? selection.edgeIds[0] : null;

  const selectedConnection = selectedEdgeId
    ? connections.find((c) => c.edge.id === selectedEdgeId)
    : undefined;

  const goTo = (nodeId: string) => {
    goToNode(nodeId);
    // The canvas is behind the dialog — get out of the way after navigating.
    onClose();
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="lg" fullWidth>
      <DialogTitle sx={{ pb: 1 }}>
        Connection Manager
        <Typography variant="caption" color="text.secondary" display="block">
          Cross-floor connections only ({connections.length}). Same-floor edges
          are edited on the canvas.
        </Typography>
      </DialogTitle>

      <DialogContent dividers sx={{ p: 0 }}>
        {connections.length === 0 ? (
          <Box sx={{ p: 3, textAlign: 'center' }}>
            <Typography variant="body2" color="text.secondary">
              No cross-floor connections yet.
            </Typography>
            <Typography variant="caption" color="text.disabled">
              Use the Add Edge tool, click a node, switch floor, then click the
              destination node.
            </Typography>
          </Box>
        ) : (
          <Stack direction="row" sx={{ height: '62vh' }}>
            <Box sx={{ flex: 1, minWidth: 0, overflow: 'auto' }}>
              <Table size="small" stickyHeader>
                <TableHead>
                  <TableRow>
                    <TableCell>Name</TableCell>
                    <TableCell>Type</TableCell>
                    <TableCell>Source</TableCell>
                    <TableCell>Destination</TableCell>
                    <TableCell align="right">Weight</TableCell>
                    <TableCell align="right" sx={{ whiteSpace: 'nowrap' }}>
                      Actions
                    </TableCell>
                  </TableRow>
                </TableHead>

                <TableBody>
                  {connections.map((connection) => {
                    const { edge, from, to, crossBuilding } = connection;
                    const selected = edge.id === selectedEdgeId;

                    return (
                      <TableRow
                        key={edge.id}
                        hover
                        selected={selected}
                        onClick={() => selectEdges([edge.id])}
                        sx={{ cursor: 'pointer' }}
                      >
                        <TableCell sx={{ maxWidth: 180 }}>
                          <Typography variant="body2" noWrap>
                            {edgeDisplayName(edge)}
                          </Typography>
                          {!edge.bidirectional && (
                            <Typography variant="caption" color="text.secondary">
                              one-way
                            </Typography>
                          )}
                        </TableCell>

                        <TableCell>
                          <Chip
                            size="small"
                            label={typeLabel(edge.edgeType)}
                            variant="outlined"
                            sx={{
                              height: 20,
                              borderColor: EDGE_COLORS[edge.edgeType],
                              color: EDGE_COLORS[edge.edgeType],
                              '& .MuiChip-label': { px: 0.75, fontSize: 11 },
                            }}
                          />
                        </TableCell>

                        <TableCell>
                          <EndpointCell
                            node={labelFor(from)}
                            where={`${from.building.name} · ${from.floor.name}`}
                          />
                        </TableCell>

                        <TableCell>
                          <EndpointCell
                            node={labelFor(to)}
                            where={`${to.building.name} · ${to.floor.name}`}
                            flagged={crossBuilding}
                          />
                        </TableCell>

                        <TableCell align="right">{edge.weight}</TableCell>

                        <TableCell align="right" sx={{ whiteSpace: 'nowrap' }}>
                          <Tooltip title="Go to source">
                            <IconButton
                              size="small"
                              onClick={(e) => {
                                e.stopPropagation();
                                goTo(edge.from);
                              }}
                            >
                              <LogoutIcon
                                sx={{ fontSize: 16, transform: 'rotate(180deg)' }}
                              />
                            </IconButton>
                          </Tooltip>
                          <Tooltip title="Go to destination">
                            <IconButton
                              size="small"
                              onClick={(e) => {
                                e.stopPropagation();
                                goTo(edge.to);
                              }}
                            >
                              <LoginIcon sx={{ fontSize: 16 }} />
                            </IconButton>
                          </Tooltip>
                          <Tooltip title="Delete connection">
                            <IconButton
                              size="small"
                              onClick={(e) => {
                                e.stopPropagation();
                                deleteEdges([edge.id]);
                              }}
                            >
                              <DeleteOutlineIcon sx={{ fontSize: 16 }} />
                            </IconButton>
                          </Tooltip>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </Box>

            {/* Editor pane — the same component the right-hand dock renders. */}
            <Box
              sx={{
                width: 300,
                flexShrink: 0,
                borderLeft: '1px solid',
                borderColor: 'divider',
                overflow: 'auto',
              }}
            >
              {selectedConnection ? (
                <EdgeProperties edge={selectedConnection.edge} />
              ) : (
                <Box sx={{ p: 2 }}>
                  <Typography variant="body2" color="text.secondary">
                    Select a connection to edit it.
                  </Typography>
                </Box>
              )}
            </Box>
          </Stack>
        )}
      </DialogContent>

      <DialogActions>
        <Button onClick={onClose}>Close</Button>
      </DialogActions>
    </Dialog>
  );
}

function EndpointCell({
  node,
  where,
  flagged,
}: {
  node: string;
  where: string;
  flagged?: boolean;
}) {
  return (
    <Box sx={{ minWidth: 0 }}>
      <Typography variant="body2" noWrap>
        {node}
      </Typography>
      <Typography
        variant="caption"
        color={flagged ? 'warning.main' : 'text.secondary'}
        noWrap
        display="block"
      >
        {where}
      </Typography>
    </Box>
  );
}
