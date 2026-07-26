import {
  Box,
  Button,
  IconButton,
  List,
  ListItemButton,
  ListItemSecondaryAction,
  ListItemText,
  Stack,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import ArrowDownwardIcon from '@mui/icons-material/ArrowDownward';
import ArrowUpwardIcon from '@mui/icons-material/ArrowUpward';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import ImageIcon from '@mui/icons-material/Image';
import { useState } from 'react';
import { useEditorStore } from '@/store/useEditorStore';

export function FloorPanel() {
  const project = useEditorStore((s) => s.project);
  const setActiveFloor = useEditorStore((s) => s.setActiveFloor);
  const addFloor = useEditorStore((s) => s.addFloor);
  const removeFloor = useEditorStore((s) => s.removeFloor);
  const renameFloor = useEditorStore((s) => s.renameFloor);
  const moveFloor = useEditorStore((s) => s.moveFloor);
  const openImage = useEditorStore((s) => s.openImageForActiveFloor);
  const setProjectName = useEditorStore((s) => s.setProjectName);

  const [editingId, setEditingId] = useState<number | null>(null);
  const [editName, setEditName] = useState('');

  // List order is user-defined (drag-free reorder via the arrow buttons).
  const floors = project.floors;

  return (
    <Box sx={{ p: 1.5, height: '100%', display: 'flex', flexDirection: 'column' }}>
      <Typography
        variant="overline"
        color="text.secondary"
        sx={{ letterSpacing: 1, display: 'block', mb: 1 }}
      >
        Project
      </Typography>

      <TextField
        label="Project name"
        value={project.name}
        onChange={(e) => setProjectName(e.target.value)}
        size="small"
        sx={{ mb: 2 }}
      />

      <Stack direction="row" alignItems="center" justifyContent="space-between" mb={1}>
        <Typography variant="overline" color="text.secondary" sx={{ letterSpacing: 1 }}>
          Floors ({floors.length})
        </Typography>
        <Tooltip title="Add floor">
          <span>
            <IconButton size="small" onClick={addFloor} color="primary">
              <AddIcon fontSize="small" />
            </IconButton>
          </span>
        </Tooltip>
      </Stack>

      <List dense sx={{ flex: 1, overflow: 'auto', mx: -1 }}>
        {floors.map((floor, index) => {
          const selected = floor.id === project.activeFloorId;
          const nodeCount = floor.nodes.length;
          const edgeCount = floor.edges.length;

          return (
            <ListItemButton
              key={floor.id}
              selected={selected}
              onClick={() => setActiveFloor(floor.id)}
              onDoubleClick={() => {
                setEditingId(floor.id);
                setEditName(floor.name);
              }}
              sx={{ borderRadius: 1, mb: 0.5, pr: 11 }}
            >
              {editingId === floor.id ? (
                <TextField
                  autoFocus
                  size="small"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  onBlur={() => {
                    if (editName.trim()) renameFloor(floor.id, editName.trim());
                    setEditingId(null);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      if (editName.trim()) renameFloor(floor.id, editName.trim());
                      setEditingId(null);
                    }
                    if (e.key === 'Escape') setEditingId(null);
                  }}
                  onClick={(e) => e.stopPropagation()}
                  fullWidth
                />
              ) : (
                <ListItemText
                  primary={floor.name}
                  secondary={
                    floor.imageName
                      ? `${floor.imageName} · ${nodeCount}n / ${edgeCount}e`
                      : `No image · ${nodeCount}n / ${edgeCount}e`
                  }
                  primaryTypographyProps={{ fontWeight: selected ? 600 : 400 }}
                  secondaryTypographyProps={{ noWrap: true }}
                />
              )}
              <ListItemSecondaryAction>
                <Stack direction="row" spacing={0}>
                  <Tooltip title="Move floor up">
                    <span>
                      <IconButton
                        size="small"
                        disabled={index === 0}
                        onClick={(e) => {
                          e.stopPropagation();
                          moveFloor(floor.id, -1);
                        }}
                      >
                        <ArrowUpwardIcon fontSize="small" />
                      </IconButton>
                    </span>
                  </Tooltip>
                  <Tooltip title="Move floor down">
                    <span>
                      <IconButton
                        size="small"
                        disabled={index === floors.length - 1}
                        onClick={(e) => {
                          e.stopPropagation();
                          moveFloor(floor.id, 1);
                        }}
                      >
                        <ArrowDownwardIcon fontSize="small" />
                      </IconButton>
                    </span>
                  </Tooltip>
                  <Tooltip title="Remove floor">
                    <span>
                      <IconButton
                        edge="end"
                        size="small"
                        disabled={floors.length <= 1}
                        onClick={(e) => {
                          e.stopPropagation();
                          removeFloor(floor.id);
                        }}
                      >
                        <DeleteOutlineIcon fontSize="small" />
                      </IconButton>
                    </span>
                  </Tooltip>
                </Stack>
              </ListItemSecondaryAction>
            </ListItemButton>
          );
        })}
      </List>

      <Button
        startIcon={<ImageIcon />}
        variant="outlined"
        fullWidth
        onClick={() => void openImage()}
        sx={{ mt: 1 }}
      >
        Load floor image
      </Button>
    </Box>
  );
}
