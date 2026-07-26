import {
  AppBar,
  Box,
  Button,
  Divider,
  IconButton,
  MenuItem,
  Select,
  Stack,
  ToggleButton,
  ToggleButtonGroup,
  Toolbar as MuiToolbar,
  Tooltip,
  Typography,
} from '@mui/material';
import NearMeIcon from '@mui/icons-material/NearMe';
import PanToolIcon from '@mui/icons-material/PanTool';
import AddLocationAltIcon from '@mui/icons-material/AddLocationAlt';
import TimelineIcon from '@mui/icons-material/Timeline';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import UndoIcon from '@mui/icons-material/Undo';
import RedoIcon from '@mui/icons-material/Redo';
import SaveIcon from '@mui/icons-material/Save';
import FolderOpenIcon from '@mui/icons-material/FolderOpen';
import NoteAddIcon from '@mui/icons-material/NoteAdd';
import ImageIcon from '@mui/icons-material/Image';
import FileDownloadIcon from '@mui/icons-material/FileDownload';
import FitScreenIcon from '@mui/icons-material/FitScreen';
import ZoomInIcon from '@mui/icons-material/ZoomIn';
import ZoomOutIcon from '@mui/icons-material/ZoomOut';
import LabelIcon from '@mui/icons-material/Label';
import StraightenIcon from '@mui/icons-material/Straighten';
import { useEditorStore } from '@/store/useEditorStore';
import type { EditorTool, NodeType } from '@/models/types';
import { NODE_TYPE_OPTIONS } from '@/utils/constants';

export function Toolbar() {
  const tool = useEditorStore((s) => s.tool);
  const defaultNodeType = useEditorStore((s) => s.defaultNodeType);
  const project = useEditorStore((s) => s.project);
  const isDirty = useEditorStore((s) => s.isDirty);
  const showNodeLabels = useEditorStore((s) => s.showNodeLabels);
  const showDistances = useEditorStore((s) => s.showDistances);
  const history = useEditorStore((s) => s.history);
  const viewport = useEditorStore((s) => s.viewport);

  const setTool = useEditorStore((s) => s.setTool);
  const setDefaultNodeType = useEditorStore((s) => s.setDefaultNodeType);
  const undo = useEditorStore((s) => s.undo);
  const redo = useEditorStore((s) => s.redo);
  const saveProject = useEditorStore((s) => s.saveProject);
  const openProject = useEditorStore((s) => s.openProject);
  const newProject = useEditorStore((s) => s.newProject);
  const openImage = useEditorStore((s) => s.openImageForActiveFloor);
  const exportJson = useEditorStore((s) => s.exportJson);
  const fitToScreen = useEditorStore((s) => s.fitToScreen);
  const zoomBy = useEditorStore((s) => s.zoomBy);
  const setShowNodeLabels = useEditorStore((s) => s.setShowNodeLabels);
  const setShowDistances = useEditorStore((s) => s.setShowDistances);
  const deleteSelection = useEditorStore((s) => s.deleteSelection);

  const handleTool = (_: React.MouseEvent<HTMLElement>, value: EditorTool | null) => {
    if (value) setTool(value);
  };

  return (
    <AppBar position="static" elevation={0} color="transparent">
      <MuiToolbar
        variant="dense"
        sx={{
          gap: 0.5,
          minHeight: 48,
          px: 1,
          flexWrap: 'wrap',
        }}
      >
        <Typography
          variant="subtitle1"
          sx={{ fontWeight: 700, letterSpacing: 0.3, mr: 1, whiteSpace: 'nowrap' }}
        >
          Map Editor
          {isDirty && (
            <Box component="span" sx={{ color: 'warning.main', ml: 0.5 }}>
              •
            </Box>
          )}
        </Typography>

        <Typography
          variant="caption"
          color="text.secondary"
          sx={{ maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', mr: 1 }}
        >
          {project.name}
        </Typography>

        <Divider orientation="vertical" flexItem sx={{ mx: 0.5 }} />

        <Stack direction="row" spacing={0.25}>
          <Tooltip title="New project (Ctrl+N)">
            <IconButton onClick={() => newProject()}>
              <NoteAddIcon fontSize="small" />
            </IconButton>
          </Tooltip>
          <Tooltip title="Open project (Ctrl+O)">
            <IconButton onClick={() => void openProject()}>
              <FolderOpenIcon fontSize="small" />
            </IconButton>
          </Tooltip>
          <Tooltip title="Save (Ctrl+S)">
            <IconButton onClick={() => void saveProject()} color={isDirty ? 'primary' : 'default'}>
              <SaveIcon fontSize="small" />
            </IconButton>
          </Tooltip>
          <Tooltip title="Open floor image (Ctrl+I)">
            <IconButton onClick={() => void openImage()}>
              <ImageIcon fontSize="small" />
            </IconButton>
          </Tooltip>
          <Tooltip title="Export graph JSON (Ctrl+E)">
            <IconButton onClick={() => void exportJson()}>
              <FileDownloadIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        </Stack>

        <Divider orientation="vertical" flexItem sx={{ mx: 0.5 }} />

        <Stack direction="row" spacing={0.25}>
          <Tooltip title="Undo (Ctrl+Z)">
            <span>
              <IconButton onClick={undo} disabled={history.past.length === 0}>
                <UndoIcon fontSize="small" />
              </IconButton>
            </span>
          </Tooltip>
          <Tooltip title="Redo (Ctrl+Y)">
            <span>
              <IconButton onClick={redo} disabled={history.future.length === 0}>
                <RedoIcon fontSize="small" />
              </IconButton>
            </span>
          </Tooltip>
        </Stack>

        <Divider orientation="vertical" flexItem sx={{ mx: 0.5 }} />

        <ToggleButtonGroup
          exclusive
          size="small"
          value={tool}
          onChange={handleTool}
          sx={{
            '& .MuiToggleButton-root': {
              px: 1,
              py: 0.5,
              border: '1px solid',
              borderColor: 'divider',
            },
          }}
        >
          <ToggleButton value="pointer">
            <Tooltip title="Pointer / Select (V)">
              <NearMeIcon fontSize="small" />
            </Tooltip>
          </ToggleButton>
          <ToggleButton value="pan">
            <Tooltip title="Pan (H) / Space / Middle-mouse">
              <PanToolIcon fontSize="small" />
            </Tooltip>
          </ToggleButton>
          <ToggleButton value="add-node">
            <Tooltip title="Add Node (N)">
              <AddLocationAltIcon fontSize="small" />
            </Tooltip>
          </ToggleButton>
          <ToggleButton value="add-edge">
            <Tooltip title="Add Edge (E)">
              <TimelineIcon fontSize="small" />
            </Tooltip>
          </ToggleButton>
          <ToggleButton value="delete">
            <Tooltip title="Delete tool (D)">
              <DeleteOutlineIcon fontSize="small" />
            </Tooltip>
          </ToggleButton>
        </ToggleButtonGroup>

        <Tooltip title="Delete selection (Del)">
          <IconButton onClick={deleteSelection} color="error">
            <DeleteOutlineIcon fontSize="small" />
          </IconButton>
        </Tooltip>

        {tool === 'add-node' && (
          <Select
            value={defaultNodeType}
            onChange={(e) => setDefaultNodeType(e.target.value as NodeType)}
            size="small"
            sx={{ minWidth: 120, ml: 0.5 }}
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
        )}

        <Box sx={{ flex: 1 }} />

        <Stack direction="row" spacing={0.25} alignItems="center">
          <Tooltip title={showNodeLabels ? 'Hide labels' : 'Show labels'}>
            <IconButton
              color={showNodeLabels ? 'primary' : 'default'}
              onClick={() => setShowNodeLabels(!showNodeLabels)}
            >
              <LabelIcon fontSize="small" />
            </IconButton>
          </Tooltip>
          <Tooltip title={showDistances ? 'Hide distances' : 'Show distances'}>
            <IconButton
              color={showDistances ? 'primary' : 'default'}
              onClick={() => setShowDistances(!showDistances)}
            >
              <StraightenIcon fontSize="small" />
            </IconButton>
          </Tooltip>
          <Tooltip title="Zoom out">
            <IconButton onClick={() => zoomBy(1 / 1.15)}>
              <ZoomOutIcon fontSize="small" />
            </IconButton>
          </Tooltip>
          <Button size="small" onClick={fitToScreen} sx={{ minWidth: 56 }}>
            {Math.round(viewport.scale * 100)}%
          </Button>
          <Tooltip title="Zoom in">
            <IconButton onClick={() => zoomBy(1.15)}>
              <ZoomInIcon fontSize="small" />
            </IconButton>
          </Tooltip>
          <Tooltip title="Fit to screen (Ctrl+0)">
            <IconButton onClick={fitToScreen}>
              <FitScreenIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        </Stack>
      </MuiToolbar>
    </AppBar>
  );
}
