import {
  FormControl,
  FormControlLabel,
  InputLabel,
  MenuItem,
  Select,
  Switch,
  TextField,
} from '@mui/material';
import { useEffect, useState } from 'react';
import type { CustomPropertySchema } from '@/models/types';
import {
  arrayToEditorText,
  editorTextToArray,
} from '@/services/propertyService';

interface PropertyValueEditorProps {
  propertyKey: string;
  value: unknown;
  schema: CustomPropertySchema;
  onChange: (value: unknown) => void;
}

/**
 * Renders the appropriate MUI control for a custom property type.
 * Commits on blur / select (except boolean, which commits immediately).
 */
export function PropertyValueEditor({
  propertyKey,
  value,
  schema,
  onChange,
}: PropertyValueEditorProps) {
  switch (schema.type) {
    case 'boolean':
      return (
        <FormControlLabel
          control={
            <Switch
              size="small"
              checked={Boolean(value)}
              onChange={(e) => onChange(e.target.checked)}
            />
          }
          label={Boolean(value) ? 'true' : 'false'}
        />
      );

    case 'enum':
      return (
        <EnumEditor
          propertyKey={propertyKey}
          value={String(value ?? '')}
          options={schema.options ?? []}
          onChange={onChange}
        />
      );

    case 'number':
      return (
        <NumberEditor
          propertyKey={propertyKey}
          value={value}
          onChange={onChange}
        />
      );

    case 'array':
      return (
        <ArrayEditor
          propertyKey={propertyKey}
          value={value}
          onChange={onChange}
        />
      );

    case 'string':
    default:
      return (
        <StringEditor
          propertyKey={propertyKey}
          value={value}
          onChange={onChange}
        />
      );
  }
}

function StringEditor({
  propertyKey,
  value,
  onChange,
}: {
  propertyKey: string;
  value: unknown;
  onChange: (value: unknown) => void;
}) {
  const [draft, setDraft] = useState(String(value ?? ''));

  useEffect(() => {
    setDraft(String(value ?? ''));
  }, [propertyKey, value]);

  const commit = () => {
    if (draft !== String(value ?? '')) {
      onChange(draft);
    }
  };

  return (
    <TextField
      label="Value"
      size="small"
      fullWidth
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
      }}
    />
  );
}

function NumberEditor({
  propertyKey,
  value,
  onChange,
}: {
  propertyKey: string;
  value: unknown;
  onChange: (value: unknown) => void;
}) {
  const [draft, setDraft] = useState(String(value ?? 0));

  useEffect(() => {
    setDraft(String(value ?? 0));
  }, [propertyKey, value]);

  const commit = () => {
    const n = Number(draft);
    if (Number.isFinite(n)) {
      if (n !== value) onChange(n);
    } else {
      setDraft(String(value ?? 0));
    }
  };

  return (
    <TextField
      label="Value"
      type="number"
      size="small"
      fullWidth
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
      }}
    />
  );
}

function EnumEditor({
  propertyKey,
  value,
  options,
  onChange,
}: {
  propertyKey: string;
  value: string;
  options: string[];
  onChange: (value: unknown) => void;
}) {
  const safeOptions = options.length > 0 ? options : [value || ''];
  const current = safeOptions.includes(value) ? value : safeOptions[0];

  return (
    <FormControl size="small" fullWidth>
      <InputLabel id={`enum-${propertyKey}`}>Value</InputLabel>
      <Select
        labelId={`enum-${propertyKey}`}
        label="Value"
        value={current}
        onChange={(e) => onChange(e.target.value)}
      >
        {safeOptions.map((opt) => (
          <MenuItem key={opt} value={opt}>
            {opt}
          </MenuItem>
        ))}
      </Select>
    </FormControl>
  );
}

function ArrayEditor({
  propertyKey,
  value,
  onChange,
}: {
  propertyKey: string;
  value: unknown;
  onChange: (value: unknown) => void;
}) {
  const [draft, setDraft] = useState(arrayToEditorText(value));

  useEffect(() => {
    setDraft(arrayToEditorText(value));
  }, [propertyKey, value]);

  const commit = () => {
    const next = editorTextToArray(draft);
    const prev = Array.isArray(value) ? value.map(String) : [];
    const changed =
      next.length !== prev.length || next.some((item, i) => item !== prev[i]);
    if (changed) {
      onChange(next);
    }
  };

  return (
    <TextField
      label="Value (one item per line)"
      size="small"
      fullWidth
      multiline
      minRows={2}
      maxRows={6}
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={commit}
      helperText="Each non-empty line becomes an array element"
    />
  );
}
