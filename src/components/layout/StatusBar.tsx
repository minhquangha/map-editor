import { Box, Chip, Typography } from '@mui/material';
import { useMemo } from 'react';
import { useEditorStore } from '@/store/useEditorStore';
import { getProjectStats } from '@/services/exportService';
import { getActiveBuilding, getActiveFloor } from '@/services/projectService';
import { getFloorEdges } from '@/services/navigationService';

export function StatusBar() {
  const project = useEditorStore((s) => s.project);
  const status = useEditorStore((s) => s.status);
  const tool = useEditorStore((s) => s.tool);
  const viewport = useEditorStore((s) => s.viewport);
  const selection = useEditorStore((s) => s.selection);
  const isDirty = useEditorStore((s) => s.isDirty);
  const projectPath = useEditorStore((s) => s.projectPath);

  const building = useMemo(() => getActiveBuilding(project), [project]);
  const floor = useMemo(() => getActiveFloor(project), [project]);

  const floorEdgeCount = useMemo(
    () => getFloorEdges(project.edges, floor).length,
    [project.edges, floor]
  );

  const stats = useMemo(() => getProjectStats(project), [project]);

  const toolLabel: Record<string, string> = {
    pointer: 'Pointer',
    pan: 'Pan',
    'add-node': 'Add Node',
    'add-edge': 'Add Edge',
    delete: 'Delete',
  };

  return (
    <Box
      sx={{
        height: 28,
        px: 1.5,
        display: 'flex',
        alignItems: 'center',
        gap: 1.5,
        borderTop: '1px solid',
        borderColor: 'divider',
        bgcolor: 'background.paper',
        fontSize: 12,
        userSelect: 'none',
      }}
    >
      <Chip
        size="small"
        label={toolLabel[tool] || tool}
        color="primary"
        variant="outlined"
        sx={{ height: 20, '& .MuiChip-label': { px: 0.75, fontSize: 11 } }}
      />

      <Typography variant="caption" color="text.secondary">
        {building.name} · {floor.name}
        {floor.imageWidth > 0 && ` · ${floor.imageWidth}×${floor.imageHeight}px`}
      </Typography>

      <Typography variant="caption" color="text.secondary">
        Nodes {floor.nodes.length} · Edges {floorEdgeCount}
      </Typography>

      <Typography variant="caption" color="text.secondary">
        Project {stats.nodes}n / {stats.edges}e
        {stats.crossFloorEdges > 0 && ` (${stats.crossFloorEdges} cross-floor)`}{' '}
        · {stats.buildings} bld / {stats.floors} floors
      </Typography>

      {(selection.nodeIds.length > 0 || selection.edgeIds.length > 0) && (
        <Typography variant="caption" color="primary.main">
          Sel {selection.nodeIds.length}n / {selection.edgeIds.length}e
        </Typography>
      )}

      <Box sx={{ flex: 1 }} />

      {status && (
        <Typography
          variant="caption"
          color={
            status.severity === 'error'
              ? 'error.main'
              : status.severity === 'warning'
                ? 'warning.main'
                : status.severity === 'success'
                  ? 'success.main'
                  : 'text.secondary'
          }
          sx={{ maxWidth: 420, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
        >
          {status.message}
        </Typography>
      )}

      <Typography variant="caption" color="text.secondary">
        {Math.round(viewport.scale * 100)}%
      </Typography>

      <Typography variant="caption" color={isDirty ? 'warning.main' : 'text.secondary'}>
        {isDirty ? 'Unsaved' : projectPath ? 'Saved' : 'No file'}
      </Typography>
    </Box>
  );
}
