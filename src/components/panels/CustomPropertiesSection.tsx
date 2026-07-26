import AddIcon from '@mui/icons-material/Add';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import DriveFileRenameOutlineIcon from '@mui/icons-material/DriveFileRenameOutline';
import {
  Box,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  FormControl,
  IconButton,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import { useEffect, useMemo, useState } from 'react';
import type {
  CustomPropertySchema,
  CustomPropertyType,
  GraphNode,
} from '@/models/types';
import {
  getPropertyTypeOptions,
  listPropertyKeys,
  validatePropertyKey,
} from '@/services/propertyService';
import { PropertyValueEditor } from './PropertyValueEditor';

interface CustomPropertiesSectionProps {
  node: GraphNode;
  onAdd: (key: string, type: CustomPropertyType, options?: string[]) => void;
  onRename: (oldKey: string, newKey: string) => void;
  onDelete: (key: string) => void;
  onValueChange: (key: string, value: unknown) => void;
  onSchemaChange: (key: string, schema: CustomPropertySchema) => void;
}

export function CustomPropertiesSection({
  node,
  onAdd,
  onRename,
  onDelete,
  onValueChange,
  onSchemaChange,
}: CustomPropertiesSectionProps) {
  const keys = useMemo(() => listPropertyKeys(node), [node]);
  const [addOpen, setAddOpen] = useState(false);
  const [renameTarget, setRenameTarget] = useState<string | null>(null);

  return (
    <Box>
      <Stack
        direction="row"
        alignItems="center"
        justifyContent="space-between"
        sx={{ mb: 1 }}
      >
        <Typography variant="subtitle2" color="text.secondary">
          Custom Properties
        </Typography>
        <Button
          size="small"
          startIcon={<AddIcon />}
          onClick={() => setAddOpen(true)}
        >
          Add
        </Button>
      </Stack>

      {keys.length === 0 ? (
        <Typography variant="caption" color="text.secondary">
          No custom properties. Add fields such as roomCode, capacity, or
          tags.
        </Typography>
      ) : (
        <Stack spacing={1.5} divider={<Divider flexItem />}>
          {keys.map((key) => {
            const schema = node.propertySchema[key] ?? { type: 'string' as const };
            return (
              <PropertyRow
                key={key}
                propertyKey={key}
                value={node.properties[key]}
                schema={schema}
                onValueChange={(value) => onValueChange(key, value)}
                onTypeChange={(type) =>
                  onSchemaChange(key, {
                    type,
                    options:
                      type === 'enum'
                        ? schema.options?.length
                          ? schema.options
                          : ['option1']
                        : undefined,
                  })
                }
                onOptionsChange={(options) =>
                  onSchemaChange(key, { type: 'enum', options })
                }
                onRename={() => setRenameTarget(key)}
                onDelete={() => onDelete(key)}
              />
            );
          })}
        </Stack>
      )}

      <AddPropertyDialog
        open={addOpen}
        existingKeys={keys}
        onClose={() => setAddOpen(false)}
        onSubmit={(key, type, options) => {
          onAdd(key, type, options);
          setAddOpen(false);
        }}
      />

      <RenamePropertyDialog
        open={renameTarget !== null}
        currentKey={renameTarget ?? ''}
        existingKeys={keys}
        onClose={() => setRenameTarget(null)}
        onSubmit={(newKey) => {
          if (renameTarget) {
            onRename(renameTarget, newKey);
          }
          setRenameTarget(null);
        }}
      />
    </Box>
  );
}

function PropertyRow({
  propertyKey,
  value,
  schema,
  onValueChange,
  onTypeChange,
  onOptionsChange,
  onRename,
  onDelete,
}: {
  propertyKey: string;
  value: unknown;
  schema: CustomPropertySchema;
  onValueChange: (value: unknown) => void;
  onTypeChange: (type: CustomPropertyType) => void;
  onOptionsChange: (options: string[]) => void;
  onRename: () => void;
  onDelete: () => void;
}) {
  const [optionsDraft, setOptionsDraft] = useState(
    (schema.options ?? []).join(', ')
  );

  // Keep options draft in sync when schema changes externally.
  const optionsKey = (schema.options ?? []).join('\0');
  useEffect(() => {
    setOptionsDraft((schema.options ?? []).join(', '));
  }, [propertyKey, optionsKey, schema.options]);

  return (
    <Box
      sx={{
        p: 1,
        borderRadius: 1,
        bgcolor: 'action.hover',
      }}
    >
      <Stack
        direction="row"
        alignItems="center"
        justifyContent="space-between"
        spacing={0.5}
        sx={{ mb: 1 }}
      >
        <Stack direction="row" alignItems="center" spacing={0.75} sx={{ minWidth: 0 }}>
          <Typography
            variant="body2"
            fontWeight={600}
            noWrap
            title={propertyKey}
          >
            {propertyKey}
          </Typography>
          <Chip label={schema.type} size="small" variant="outlined" />
        </Stack>
        <Stack direction="row" spacing={0}>
          <Tooltip title="Rename">
            <IconButton size="small" onClick={onRename} aria-label="Rename property">
              <DriveFileRenameOutlineIcon fontSize="small" />
            </IconButton>
          </Tooltip>
          <Tooltip title="Delete">
            <IconButton
              size="small"
              color="error"
              onClick={onDelete}
              aria-label="Delete property"
            >
              <DeleteOutlineIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        </Stack>
      </Stack>

      <Stack spacing={1}>
        <FormControl size="small" fullWidth>
          <InputLabel>Type</InputLabel>
          <Select
            label="Type"
            value={schema.type}
            onChange={(e) => onTypeChange(e.target.value as CustomPropertyType)}
          >
            {getPropertyTypeOptions().map((opt) => (
              <MenuItem key={opt.value} value={opt.value}>
                {opt.label}
              </MenuItem>
            ))}
          </Select>
        </FormControl>

        {schema.type === 'enum' && (
          <TextField
            label="Enum options"
            size="small"
            fullWidth
            value={optionsDraft}
            onChange={(e) => setOptionsDraft(e.target.value)}
            onBlur={() => {
              const options = optionsDraft
                .split(',')
                .map((s) => s.trim())
                .filter(Boolean);
              if (options.length === 0) {
                setOptionsDraft((schema.options ?? []).join(', '));
                return;
              }
              const prev = schema.options ?? [];
              const changed =
                options.length !== prev.length ||
                options.some((o, i) => o !== prev[i]);
              if (changed) onOptionsChange(options);
            }}
            helperText="Comma-separated choices"
            placeholder="A, B, C"
          />
        )}

        <PropertyValueEditor
          propertyKey={propertyKey}
          value={value}
          schema={schema}
          onChange={onValueChange}
        />
      </Stack>
    </Box>
  );
}

function AddPropertyDialog({
  open,
  existingKeys,
  onClose,
  onSubmit,
}: {
  open: boolean;
  existingKeys: string[];
  onClose: () => void;
  onSubmit: (key: string, type: CustomPropertyType, options?: string[]) => void;
}) {
  const [key, setKey] = useState('');
  const [type, setType] = useState<CustomPropertyType>('string');
  const [optionsText, setOptionsText] = useState('option1, option2');
  const [error, setError] = useState<string | null>(null);

  const reset = () => {
    setKey('');
    setType('string');
    setOptionsText('option1, option2');
    setError(null);
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  const handleSubmit = () => {
    const keyError = validatePropertyKey(key, existingKeys);
    if (keyError) {
      setError(keyError);
      return;
    }

    if (type === 'enum') {
      const options = optionsText
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);
      if (options.length === 0) {
        setError('Enum requires at least one option.');
        return;
      }
      onSubmit(key.trim(), type, options);
    } else {
      onSubmit(key.trim(), type);
    }
    reset();
  };

  return (
    <Dialog open={open} onClose={handleClose} fullWidth maxWidth="xs">
      <DialogTitle>Add Property</DialogTitle>
      <DialogContent>
        <Stack spacing={1.5} sx={{ mt: 0.5 }}>
          <TextField
            autoFocus
            label="Name"
            size="small"
            fullWidth
            value={key}
            onChange={(e) => {
              setKey(e.target.value);
              setError(null);
            }}
            error={Boolean(error)}
            helperText={error ?? 'e.g. roomCode, capacity, isAccessible'}
            placeholder="propertyName"
          />
          <FormControl size="small" fullWidth>
            <InputLabel>Type</InputLabel>
            <Select
              label="Type"
              value={type}
              onChange={(e) => setType(e.target.value as CustomPropertyType)}
            >
              {getPropertyTypeOptions().map((opt) => (
                <MenuItem key={opt.value} value={opt.value}>
                  {opt.label}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          {type === 'enum' && (
            <TextField
              label="Enum options"
              size="small"
              fullWidth
              value={optionsText}
              onChange={(e) => setOptionsText(e.target.value)}
              helperText="Comma-separated"
            />
          )}
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={handleClose}>Cancel</Button>
        <Button variant="contained" onClick={handleSubmit}>
          Add
        </Button>
      </DialogActions>
    </Dialog>
  );
}

function RenamePropertyDialog({
  open,
  currentKey,
  existingKeys,
  onClose,
  onSubmit,
}: {
  open: boolean;
  currentKey: string;
  existingKeys: string[];
  onClose: () => void;
  onSubmit: (newKey: string) => void;
}) {
  const [key, setKey] = useState(currentKey);
  const [error, setError] = useState<string | null>(null);

  // Reset when dialog opens with a new target.
  useEffect(() => {
    if (open) {
      setKey(currentKey);
      setError(null);
    }
  }, [open, currentKey]);

  const handleSubmit = () => {
    const keyError = validatePropertyKey(key, existingKeys, {
      excludeKey: currentKey,
    });
    if (keyError) {
      setError(keyError);
      return;
    }
    onSubmit(key.trim());
  };

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="xs">
      <DialogTitle>Rename Property</DialogTitle>
      <DialogContent>
        <TextField
          autoFocus
          label="New name"
          size="small"
          fullWidth
          sx={{ mt: 0.5 }}
          value={key}
          onChange={(e) => {
            setKey(e.target.value);
            setError(null);
          }}
          error={Boolean(error)}
          helperText={error ?? undefined}
          onKeyDown={(e) => {
            if (e.key === 'Enter') handleSubmit();
          }}
        />
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button variant="contained" onClick={handleSubmit}>
          Rename
        </Button>
      </DialogActions>
    </Dialog>
  );
}
