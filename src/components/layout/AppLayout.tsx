import { Box, Paper } from '@mui/material';
import { Toolbar } from './Toolbar';
import { StatusBar } from './StatusBar';
import { BuildingPanel } from '@/components/panels/BuildingPanel';
import { PropertiesPanel } from '@/components/panels/PropertiesPanel';
import { EditorCanvas } from '@/components/canvas/EditorCanvas';

const LEFT_PANEL_WIDTH = 300;
const RIGHT_PANEL_WIDTH = 280;

export function AppLayout() {
  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        width: '100%',
        height: '100%',
        bgcolor: 'background.default',
        overflow: 'hidden',
      }}
    >
      <Toolbar />

      <Box sx={{ flex: 1, display: 'flex', minHeight: 0 }}>
        {/* Left dock — project tree (buildings → floors) */}
        <Paper
          elevation={0}
          square
          sx={{
            width: LEFT_PANEL_WIDTH,
            flexShrink: 0,
            borderRight: '1px solid',
            borderColor: 'divider',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
          }}
        >
          <BuildingPanel />
        </Paper>

        {/* Center — canvas */}
        <Box sx={{ flex: 1, minWidth: 0, position: 'relative' }}>
          <EditorCanvas />
        </Box>

        {/* Right dock — properties */}
        <Paper
          elevation={0}
          square
          sx={{
            width: RIGHT_PANEL_WIDTH,
            flexShrink: 0,
            borderLeft: '1px solid',
            borderColor: 'divider',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
          }}
        >
          <PropertiesPanel />
        </Paper>
      </Box>

      <StatusBar />
    </Box>
  );
}
