import { Box, Button, Stack, Typography } from '@mui/material';
import { useEffect, useState } from 'react';
import type { Metadata } from '@/models/types';

interface MetadataEditorProps {
  value: Metadata | undefined;
  onChange: (next: Metadata | undefined) => void;
  /** Shown under the field when the JSON is valid. */
  helperText?: string;
}

const EMPTY = '{}';

function format(value: Metadata | undefined): string {
  if (!value || Object.keys(value).length === 0) return EMPTY;
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return EMPTY;
  }
}

/**
 * Free-form metadata bag editor.
 *
 * Applies only on valid JSON objects, so a half-typed edit can never clobber
 * stored data. An empty object clears the field rather than storing `{}`.
 */
export function MetadataEditor({
  value,
  onChange,
  helperText,
}: MetadataEditorProps) {
  const [text, setText] = useState(() => format(value));
  const [error, setError] = useState<string | null>(null);

  // Re-sync when a different object is selected, or metadata changes elsewhere
  // (undo, JSON editor) — but not while the user is mid-edit with an error.
  const external = format(value);
  useEffect(() => {
    setText(external);
    setError(null);
  }, [external]);

  const dirty = text !== external;

  const apply = () => {
    let parsed: unknown;
    try {
      parsed = JSON.parse(text.trim() || EMPTY);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Invalid JSON.');
      return;
    }
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      setError('Metadata must be a JSON object.');
      return;
    }
    setError(null);
    const next = parsed as Metadata;
    onChange(Object.keys(next).length === 0 ? undefined : next);
  };

  const reset = () => {
    setText(external);
    setError(null);
  };

  return (
    <Box>
      <Typography
        variant="caption"
        color="text.secondary"
        sx={{ display: 'block', mb: 0.5 }}
      >
        Metadata
      </Typography>

      <Box
        component="textarea"
        value={text}
        onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => {
          setText(e.target.value);
          if (error) setError(null);
        }}
        spellCheck={false}
        rows={5}
        sx={{
          width: '100%',
          resize: 'vertical',
          p: 1,
          borderRadius: 1,
          border: '1px solid',
          borderColor: error ? 'error.main' : 'divider',
          bgcolor: 'background.default',
          color: 'text.primary',
          fontFamily: 'monospace',
          fontSize: 12,
          lineHeight: '17px',
          outline: 'none',
        }}
      />

      <Typography
        variant="caption"
        color={error ? 'error.main' : 'text.secondary'}
        sx={{ display: 'block', minHeight: 18 }}
      >
        {error ?? helperText ?? 'Any JSON object. Unknown keys are preserved.'}
      </Typography>

      {dirty && (
        <Stack direction="row" spacing={1} sx={{ mt: 0.5 }}>
          <Button size="small" variant="contained" onClick={apply}>
            Apply
          </Button>
          <Button size="small" color="inherit" onClick={reset}>
            Revert
          </Button>
        </Stack>
      )}
    </Box>
  );
}
