import {
  Box,
  Chip,
  List,
  ListItemButton,
  ListItemText,
  Stack,
  Tooltip,
  Typography,
} from '@mui/material';
import ArrowForwardIcon from '@mui/icons-material/ArrowForward';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import SwapHorizIcon from '@mui/icons-material/SwapHoriz';
import { useMemo } from 'react';
import { useEditorStore } from '@/store/useEditorStore';
import {
  buildNodeIndex,
  describeDestination,
  getNodeConnections,
  labelFor,
} from '@/services/navigationService';
import { EDGE_COLORS, EDGE_TYPE_OPTIONS } from '@/utils/constants';

interface ConnectionsSectionProps {
  nodeId: string;
}

function typeLabel(value: string): string {
  return EDGE_TYPE_OPTIONS.find((o) => o.value === value)?.label ?? value;
}

/**
 * Every edge touching the selected node, wherever the far end lives.
 *
 * Clicking a row navigates to the destination — switching building and floor,
 * selecting the node and centring on it — the way "Go to definition" works.
 */
export function ConnectionsSection({ nodeId }: ConnectionsSectionProps) {
  const project = useEditorStore((s) => s.project);
  const goToNode = useEditorStore((s) => s.goToNode);
  const selectEdges = useEditorStore((s) => s.selectEdges);

  const connections = useMemo(() => {
    const index = buildNodeIndex(project);
    return getNodeConnections(project.edges, nodeId, index);
  }, [project, nodeId]);

  if (connections.length === 0) {
    return (
      <Box>
        <SectionLabel count={0} />
        <Typography variant="caption" color="text.disabled">
          No connections yet.
        </Typography>
      </Box>
    );
  }

  return (
    <Box>
      <SectionLabel count={connections.length} />

      <List dense disablePadding>
        {connections.map((connection) => {
          const { edge, target, outgoing, crossFloor } = connection;
          const color = EDGE_COLORS[edge.edgeType];

          return (
            <ListItemButton
              key={edge.id}
              onClick={() => goToNode(target.node.id)}
              sx={{ borderRadius: 1, py: 0.25, px: 0.75, mb: 0.25 }}
            >
              <Tooltip
                title={
                  edge.bidirectional
                    ? 'Bidirectional'
                    : outgoing
                      ? 'One-way, outgoing'
                      : 'One-way, incoming'
                }
              >
                <Box
                  sx={{
                    display: 'flex',
                    alignItems: 'center',
                    color,
                    mr: 0.75,
                  }}
                >
                  {edge.bidirectional ? (
                    <SwapHorizIcon sx={{ fontSize: 16 }} />
                  ) : outgoing ? (
                    <ArrowForwardIcon sx={{ fontSize: 16 }} />
                  ) : (
                    <ArrowBackIcon sx={{ fontSize: 16 }} />
                  )}
                </Box>
              </Tooltip>

              <ListItemText
                primary={labelFor(target)}
                secondary={
                  <Stack
                    direction="row"
                    spacing={0.5}
                    alignItems="center"
                    component="span"
                  >
                    <Box component="span">{describeDestination(connection)}</Box>
                    <Box component="span" sx={{ color: 'text.disabled' }}>
                      ·
                    </Box>
                    <Box component="span" sx={{ color }}>
                      {typeLabel(edge.edgeType)}
                    </Box>
                    <Box component="span" sx={{ color: 'text.disabled' }}>
                      w{edge.weight}
                    </Box>
                  </Stack>
                }
                primaryTypographyProps={{ variant: 'body2', noWrap: true }}
                secondaryTypographyProps={{
                  variant: 'caption',
                  noWrap: true,
                  component: 'span',
                }}
              />

              {crossFloor && (
                <Tooltip title="Select this edge">
                  <Chip
                    size="small"
                    label="⇅"
                    onClick={(e) => {
                      e.stopPropagation();
                      selectEdges([edge.id]);
                    }}
                    sx={{
                      height: 18,
                      ml: 0.5,
                      '& .MuiChip-label': { px: 0.75, fontSize: 11 },
                    }}
                  />
                </Tooltip>
              )}
            </ListItemButton>
          );
        })}
      </List>
    </Box>
  );
}

function SectionLabel({ count }: { count: number }) {
  return (
    <Typography
      variant="overline"
      color="text.secondary"
      sx={{ letterSpacing: 1, display: 'block' }}
    >
      Connections{count > 0 ? ` (${count})` : ''}
    </Typography>
  );
}
