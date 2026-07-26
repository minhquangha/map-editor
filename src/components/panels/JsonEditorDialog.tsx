import {
  Alert,
  Box,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Stack,
  Typography,
} from '@mui/material';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useEditorStore } from '@/store/useEditorStore';

interface JsonEditorDialogProps {
  open: boolean;
  onClose: () => void;
}

interface SyntaxProblem {
  message: string;
  /** 1-based caret position, when the engine reports one. */
  line: number;
  column: number;
  /** Absolute character offset into the document. */
  offset: number;
}

/** Warn above this size — floor images are embedded as data URLs. */
const LARGE_DOCUMENT_BYTES = 2_000_000;

/**
 * Translate a JSON.parse failure into a caret position.
 * V8 reports "... at position N"; the line/column is derived from N so the
 * result is stable across engine message formats.
 */
function locateSyntaxError(text: string, error: unknown): SyntaxProblem {
  const message = error instanceof Error ? error.message : 'Invalid JSON.';
  const match = /at position (\d+)/.exec(message);
  const offset = match ? Math.min(Number(match[1]), text.length) : 0;

  const before = text.slice(0, offset);
  const line = before.split('\n').length;
  const column = offset - (before.lastIndexOf('\n') + 1) + 1;

  return { message, line, column, offset };
}

/**
 * Full-document JSON editor for the live project.
 *
 * Everything the project holds — including unknown/custom fields — is shown
 * verbatim and written back verbatim. Nothing is applied unless the document
 * parses and passes project validation, so a broken edit can never destroy
 * the open project.
 */
export function JsonEditorDialog({ open, onClose }: JsonEditorDialogProps) {
  const getProjectJson = useEditorStore((s) => s.getProjectJson);
  const applyProjectJson = useEditorStore((s) => s.applyProjectJson);

  const [text, setText] = useState('');
  const [applyError, setApplyError] = useState<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const gutterRef = useRef<HTMLDivElement | null>(null);

  // Load a fresh copy of the project each time the dialog opens.
  useEffect(() => {
    if (open) {
      setText(getProjectJson());
      setApplyError(null);
    }
  }, [open, getProjectJson]);

  const problem = useMemo<SyntaxProblem | null>(() => {
    if (!text.trim()) {
      return { message: 'Document is empty.', line: 1, column: 1, offset: 0 };
    }
    try {
      JSON.parse(text);
      return null;
    } catch (err) {
      return locateSyntaxError(text, err);
    }
  }, [text]);

  const lineCount = useMemo(() => text.split('\n').length, [text]);
  const isValid = problem === null;
  const isLarge = text.length > LARGE_DOCUMENT_BYTES;

  const jumpToError = () => {
    const el = textareaRef.current;
    if (!el || !problem) return;
    el.focus();
    el.setSelectionRange(problem.offset, Math.min(problem.offset + 1, text.length));
    // Approximate scroll: place the failing line near the top of the viewport.
    const lineHeight = el.scrollHeight / Math.max(lineCount, 1);
    el.scrollTop = Math.max(0, (problem.line - 3) * lineHeight);
    syncGutter();
  };

  const syncGutter = () => {
    if (gutterRef.current && textareaRef.current) {
      gutterRef.current.scrollTop = textareaRef.current.scrollTop;
    }
  };

  const handleFormat = () => {
    if (!isValid) return;
    setText(JSON.stringify(JSON.parse(text), null, 2));
  };

  const handleApply = () => {
    if (!isValid) return;
    try {
      applyProjectJson(text);
      setApplyError(null);
      onClose();
    } catch (err) {
      // Project-level validation failed (bad ids, missing floors, …).
      // The live project is untouched; keep the dialog open so the edit
      // is not lost.
      setApplyError(err instanceof Error ? err.message : 'Could not apply changes.');
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="lg" fullWidth>
      <DialogTitle sx={{ pb: 1 }}>
        <Stack direction="row" alignItems="center" spacing={1}>
          <Box sx={{ flex: 1 }}>Project JSON</Box>
          <Chip
            size="small"
            icon={
              isValid ? (
                <CheckCircleOutlineIcon fontSize="small" />
              ) : (
                <ErrorOutlineIcon fontSize="small" />
              )
            }
            label={isValid ? 'Valid JSON' : 'Invalid JSON'}
            color={isValid ? 'success' : 'error'}
            variant="outlined"
          />
        </Stack>
        <Typography variant="caption" color="text.secondary">
          Edits apply to the whole project. Unknown and custom fields are
          preserved exactly as written.
        </Typography>
      </DialogTitle>

      <DialogContent dividers sx={{ p: 0 }}>
        {problem && (
          <Alert
            severity="error"
            square
            action={
              <Button color="inherit" size="small" onClick={jumpToError}>
                Jump to error
              </Button>
            }
          >
            Line {problem.line}, column {problem.column} — {problem.message}
          </Alert>
        )}

        {applyError && (
          <Alert severity="error" square onClose={() => setApplyError(null)}>
            {applyError}
          </Alert>
        )}

        {isLarge && (
          <Alert severity="info" square>
            Large document ({Math.round(text.length / 1024)} KB) — floor images
            are embedded as data URLs, so editing may feel slow.
          </Alert>
        )}

        <Stack direction="row" sx={{ height: '62vh' }}>
          {/* Line-number gutter, scroll-synced with the editor. */}
          <Box
            ref={gutterRef}
            sx={{
              overflow: 'hidden',
              py: 1,
              px: 1,
              textAlign: 'right',
              userSelect: 'none',
              bgcolor: 'action.hover',
              borderRight: '1px solid',
              borderColor: 'divider',
              fontFamily: 'monospace',
              fontSize: 12,
              lineHeight: '18px',
              color: 'text.disabled',
              flexShrink: 0,
              minWidth: 52,
            }}
          >
            {Array.from({ length: lineCount }, (_, i) => (
              <Box
                key={i + 1}
                sx={{
                  color:
                    problem && problem.line === i + 1
                      ? 'error.main'
                      : 'inherit',
                  fontWeight: problem && problem.line === i + 1 ? 700 : 400,
                }}
              >
                {i + 1}
              </Box>
            ))}
          </Box>

          <Box
            component="textarea"
            ref={textareaRef}
            value={text}
            onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) =>
              setText(e.target.value)
            }
            onScroll={syncGutter}
            spellCheck={false}
            wrap="off"
            sx={{
              flex: 1,
              minWidth: 0,
              resize: 'none',
              border: 'none',
              outline: 'none',
              p: 1,
              bgcolor: 'background.paper',
              color: 'text.primary',
              fontFamily: 'monospace',
              fontSize: 12,
              lineHeight: '18px',
              whiteSpace: 'pre',
              overflow: 'auto',
            }}
          />
        </Stack>
      </DialogContent>

      <DialogActions>
        <Button onClick={handleFormat} disabled={!isValid}>
          Format
        </Button>
        <Box sx={{ flex: 1 }} />
        <Button onClick={onClose} color="inherit">
          Cancel
        </Button>
        <Button onClick={handleApply} disabled={!isValid} variant="contained">
          Apply Changes
        </Button>
      </DialogActions>
    </Dialog>
  );
}
