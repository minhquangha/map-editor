import {
  Box,
  Button,
  Collapse,
  Divider,
  IconButton,
  ListItemIcon,
  ListItemText,
  Menu,
  MenuItem,
  Paper,
  Stack,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import ApartmentIcon from '@mui/icons-material/Apartment';
import ArrowDownwardIcon from '@mui/icons-material/ArrowDownward';
import ArrowUpwardIcon from '@mui/icons-material/ArrowUpward';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import DriveFileRenameOutlineIcon from '@mui/icons-material/DriveFileRenameOutline';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ImageIcon from '@mui/icons-material/Image';
import LayersIcon from '@mui/icons-material/Layers';
import MoreVertIcon from '@mui/icons-material/MoreVert';
import { useState } from 'react';
import { FloorPanel } from '@/components/panels/FloorPanel';
import { useEditorStore } from '@/store/useEditorStore';

/**
 * Left dock: the project tree.
 *
 * Buildings → floors, generated entirely from `project.buildings`. Order is
 * array order (user-defined); nothing here is keyed off a fixed count.
 */
export function BuildingPanel() {
  const project = useEditorStore((s) => s.project);
  const setProjectName = useEditorStore((s) => s.setProjectName);
  const setActiveBuilding = useEditorStore((s) => s.setActiveBuilding);
  const addBuilding = useEditorStore((s) => s.addBuilding);
  const removeBuilding = useEditorStore((s) => s.removeBuilding);
  const renameBuilding = useEditorStore((s) => s.renameBuilding);
  const duplicateBuilding = useEditorStore((s) => s.duplicateBuilding);
  const moveBuilding = useEditorStore((s) => s.moveBuilding);
  const addFloor = useEditorStore((s) => s.addFloor);
  const openImage = useEditorStore((s) => s.openImageForActiveFloor);

  const [collapsed, setCollapsed] = useState<Set<number>>(new Set());
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editName, setEditName] = useState('');
  const [menu, setMenu] = useState<{
    anchor: HTMLElement;
    buildingId: number;
  } | null>(null);

  const buildings = project.buildings;
  const onlyOneBuilding = buildings.length <= 1;

  const toggleCollapsed = (buildingId: number) => {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(buildingId)) next.delete(buildingId);
      else next.add(buildingId);
      return next;
    });
  };

  const commitRename = (buildingId: number) => {
    if (editName.trim()) renameBuilding(buildingId, editName.trim());
    setEditingId(null);
  };

  const closeMenu = () => setMenu(null);

  const runOnMenuTarget = (action: (buildingId: number) => void) => () => {
    if (menu) action(menu.buildingId);
    closeMenu();
  };

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
          Buildings ({buildings.length})
        </Typography>
        <Tooltip title="Add building">
          <IconButton size="small" onClick={() => addBuilding()} color="primary">
            <AddIcon fontSize="small" />
          </IconButton>
        </Tooltip>
      </Stack>

      <Box sx={{ flex: 1, overflow: 'auto', mx: -0.5 }}>
        {buildings.map((building) => {
          const isActive = building.id === project.activeBuildingId;
          const isOpen = !collapsed.has(building.id);

          return (
            <Paper
              key={building.id}
              elevation={0}
              variant="outlined"
              sx={{
                mb: 0.75,
                borderColor: isActive ? 'primary.main' : 'divider',
                bgcolor: isActive ? 'action.selected' : 'transparent',
                overflow: 'hidden',
              }}
            >
              <Stack
                direction="row"
                alignItems="center"
                sx={{ px: 0.5, py: 0.25, cursor: 'pointer' }}
                onClick={() => setActiveBuilding(building.id)}
              >
                <IconButton
                  size="small"
                  onClick={(e) => {
                    e.stopPropagation();
                    toggleCollapsed(building.id);
                  }}
                >
                  {isOpen ? (
                    <ExpandLessIcon sx={{ fontSize: 18 }} />
                  ) : (
                    <ExpandMoreIcon sx={{ fontSize: 18 }} />
                  )}
                </IconButton>

                <ApartmentIcon
                  sx={{
                    fontSize: 16,
                    mr: 0.75,
                    color: isActive ? 'primary.main' : 'text.secondary',
                  }}
                />

                {editingId === building.id ? (
                  <TextField
                    autoFocus
                    size="small"
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    onBlur={() => commitRename(building.id)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') commitRename(building.id);
                      if (e.key === 'Escape') setEditingId(null);
                    }}
                    onClick={(e) => e.stopPropagation()}
                    fullWidth
                    sx={{ mr: 0.5 }}
                  />
                ) : (
                  <Box
                    sx={{ flex: 1, minWidth: 0 }}
                    onDoubleClick={() => {
                      setEditingId(building.id);
                      setEditName(building.name);
                    }}
                  >
                    <Typography
                      variant="body2"
                      noWrap
                      sx={{ fontWeight: isActive ? 700 : 500 }}
                    >
                      {building.name}
                    </Typography>
                    <Typography variant="caption" color="text.secondary" noWrap>
                      {building.description
                        ? building.description
                        : `${building.floors.length} floor${
                            building.floors.length === 1 ? '' : 's'
                          }`}
                    </Typography>
                  </Box>
                )}

                <Tooltip title="Add floor to this building">
                  <IconButton
                    size="small"
                    onClick={(e) => {
                      e.stopPropagation();
                      addFloor(building.id);
                    }}
                  >
                    <LayersIcon sx={{ fontSize: 16 }} />
                  </IconButton>
                </Tooltip>

                <Tooltip title="Building actions">
                  <IconButton
                    size="small"
                    onClick={(e) => {
                      e.stopPropagation();
                      setMenu({
                        anchor: e.currentTarget,
                        buildingId: building.id,
                      });
                    }}
                  >
                    <MoreVertIcon sx={{ fontSize: 16 }} />
                  </IconButton>
                </Tooltip>
              </Stack>

              <Collapse in={isOpen} unmountOnExit>
                <Divider />
                <Box sx={{ py: 0.5 }}>
                  <FloorPanel
                    building={building}
                    activeFloorId={
                      isActive ? project.activeFloorId : null
                    }
                  />
                </Box>
              </Collapse>
            </Paper>
          );
        })}
      </Box>

      <Button
        startIcon={<ImageIcon />}
        variant="outlined"
        fullWidth
        onClick={() => void openImage()}
        sx={{ mt: 1 }}
      >
        Load floor image
      </Button>

      <Menu
        anchorEl={menu?.anchor ?? null}
        open={Boolean(menu)}
        onClose={closeMenu}
      >
        <MenuItem
          onClick={runOnMenuTarget((id) => {
            const building = buildings.find((b) => b.id === id);
            if (!building) return;
            setEditingId(id);
            setEditName(building.name);
          })}
        >
          <ListItemIcon>
            <DriveFileRenameOutlineIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText>Rename</ListItemText>
        </MenuItem>

        <MenuItem onClick={runOnMenuTarget((id) => addFloor(id))}>
          <ListItemIcon>
            <LayersIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText>Add floor</ListItemText>
        </MenuItem>

        <MenuItem onClick={runOnMenuTarget((id) => duplicateBuilding(id))}>
          <ListItemIcon>
            <ContentCopyIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText>Duplicate</ListItemText>
        </MenuItem>

        <Divider />

        <MenuItem
          disabled={
            menu ? buildings.findIndex((b) => b.id === menu.buildingId) === 0 : true
          }
          onClick={runOnMenuTarget((id) => moveBuilding(id, -1))}
        >
          <ListItemIcon>
            <ArrowUpwardIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText>Move up</ListItemText>
        </MenuItem>

        <MenuItem
          disabled={
            menu
              ? buildings.findIndex((b) => b.id === menu.buildingId) ===
                buildings.length - 1
              : true
          }
          onClick={runOnMenuTarget((id) => moveBuilding(id, 1))}
        >
          <ListItemIcon>
            <ArrowDownwardIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText>Move down</ListItemText>
        </MenuItem>

        <Divider />

        <MenuItem
          disabled={onlyOneBuilding}
          onClick={runOnMenuTarget((id) => removeBuilding(id))}
        >
          <ListItemIcon>
            <DeleteOutlineIcon fontSize="small" color="error" />
          </ListItemIcon>
          <ListItemText
            primaryTypographyProps={{ color: onlyOneBuilding ? undefined : 'error' }}
          >
            Delete building
          </ListItemText>
        </MenuItem>
      </Menu>
    </Box>
  );
}
