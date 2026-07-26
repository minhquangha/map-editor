import {
  Box,
  IconButton,
  List,
  ListItemButton,
  ListItemSecondaryAction,
  ListItemText,
  Stack,
  TextField,
  Tooltip,
} from '@mui/material';
import ArrowDownwardIcon from '@mui/icons-material/ArrowDownward';
import ArrowUpwardIcon from '@mui/icons-material/ArrowUpward';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import { memo, useState } from 'react';
import type { Building } from '@/models/types';
import { useEditorStore } from '@/store/useEditorStore';

interface FloorPanelProps {
  building: Building;
  /** Active floor id, or null when the active floor is in another building. */
  activeFloorId: number | null;
}

/**
 * Floor list for a single building.
 *
 * Rendered once per building by `BuildingPanel`. Order is array order
 * (user-defined via the arrow buttons), never sorted by id.
 */
function FloorPanelBase({ building, activeFloorId }: FloorPanelProps) {
  const setActiveFloor = useEditorStore((s) => s.setActiveFloor);
  const removeFloor = useEditorStore((s) => s.removeFloor);
  const renameFloor = useEditorStore((s) => s.renameFloor);
  const moveFloor = useEditorStore((s) => s.moveFloor);

  const [editingId, setEditingId] = useState<number | null>(null);
  const [editName, setEditName] = useState('');

  const commitRename = (floorId: number) => {
    if (editName.trim()) renameFloor(floorId, editName.trim());
    setEditingId(null);
  };

  return (
    <List dense disablePadding sx={{ pl: 1.5 }}>
      {building.floors.map((floor, index) => {
        const selected = floor.id === activeFloorId;

        return (
          <ListItemButton
            key={floor.id}
            selected={selected}
            onClick={() => setActiveFloor(floor.id)}
            onDoubleClick={() => {
              setEditingId(floor.id);
              setEditName(floor.name);
            }}
            sx={{ borderRadius: 1, mb: 0.25, py: 0.25, pr: 10 }}
          >
            {editingId === floor.id ? (
              <TextField
                autoFocus
                size="small"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                onBlur={() => commitRename(floor.id)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') commitRename(floor.id);
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
                    ? `${floor.imageName} · ${floor.nodes.length}n / ${floor.edges.length}e`
                    : `No image · ${floor.nodes.length}n / ${floor.edges.length}e`
                }
                primaryTypographyProps={{
                  variant: 'body2',
                  fontWeight: selected ? 600 : 400,
                  noWrap: true,
                }}
                secondaryTypographyProps={{ variant: 'caption', noWrap: true }}
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
                      <ArrowUpwardIcon sx={{ fontSize: 16 }} />
                    </IconButton>
                  </span>
                </Tooltip>
                <Tooltip title="Move floor down">
                  <span>
                    <IconButton
                      size="small"
                      disabled={index === building.floors.length - 1}
                      onClick={(e) => {
                        e.stopPropagation();
                        moveFloor(floor.id, 1);
                      }}
                    >
                      <ArrowDownwardIcon sx={{ fontSize: 16 }} />
                    </IconButton>
                  </span>
                </Tooltip>
                <Tooltip
                  title={
                    building.floors.length <= 1
                      ? 'A building must keep at least one floor'
                      : 'Remove floor'
                  }
                >
                  <span>
                    <IconButton
                      edge="end"
                      size="small"
                      disabled={building.floors.length <= 1}
                      onClick={(e) => {
                        e.stopPropagation();
                        removeFloor(floor.id);
                      }}
                    >
                      <DeleteOutlineIcon sx={{ fontSize: 16 }} />
                    </IconButton>
                  </span>
                </Tooltip>
              </Stack>
            </ListItemSecondaryAction>
          </ListItemButton>
        );
      })}

      {building.floors.length === 0 && (
        <Box sx={{ px: 1, py: 0.5, fontSize: 12, color: 'text.disabled' }}>
          No floors yet.
        </Box>
      )}
    </List>
  );
}

/**
 * Memoized: a mutation on one building re-renders only that building's list,
 * which matters once a project holds many buildings and floors.
 */
export const FloorPanel = memo(FloorPanelBase);
