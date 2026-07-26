import { CssBaseline, ThemeProvider } from '@mui/material';
import { darkTheme } from '@/theme/theme';
import { EditorPage } from '@/pages/EditorPage';

export default function App() {
  return (
    <ThemeProvider theme={darkTheme}>
      <CssBaseline />
      <EditorPage />
    </ThemeProvider>
  );
}
