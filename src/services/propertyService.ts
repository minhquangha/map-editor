import type {
  CustomPropertySchema,
  CustomPropertyType,
  GraphNode,
} from '@/models/types';

const PROPERTY_TYPES: readonly CustomPropertyType[] = [
  'string',
  'number',
  'boolean',
  'enum',
  'array',
] as const;

const RESERVED_KEYS = new Set([
  'id',
  'label',
  'type',
  'room_type',
  'floor',
  'x',
  'y',
  'properties',
  'propertySchema',
]);

export function isCustomPropertyType(value: unknown): value is CustomPropertyType {
  return (
    typeof value === 'string' &&
    (PROPERTY_TYPES as readonly string[]).includes(value)
  );
}

export function getPropertyTypeOptions(): { value: CustomPropertyType; label: string }[] {
  return [
    { value: 'string', label: 'String' },
    { value: 'number', label: 'Number' },
    { value: 'boolean', label: 'Boolean' },
    { value: 'enum', label: 'Enum' },
    { value: 'array', label: 'Array' },
  ];
}

/** Default value for a newly created property of the given type. */
export function defaultValueForType(
  type: CustomPropertyType,
  options?: string[]
): unknown {
  switch (type) {
    case 'string':
      return '';
    case 'number':
      return 0;
    case 'boolean':
      return false;
    case 'enum':
      return options?.[0] ?? '';
    case 'array':
      return [];
    default:
      return null;
  }
}

/** Deep-clone a properties bag (values only). */
export function cloneProperties(
  properties: Record<string, unknown> | undefined | null
): Record<string, unknown> {
  if (!properties || typeof properties !== 'object') {
    return {};
  }
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(properties)) {
    result[key] = cloneValue(value);
  }
  return result;
}

/** Deep-clone property schema. */
export function clonePropertySchema(
  schema: Record<string, CustomPropertySchema> | undefined | null
): Record<string, CustomPropertySchema> {
  if (!schema || typeof schema !== 'object') {
    return {};
  }
  const result: Record<string, CustomPropertySchema> = {};
  for (const [key, entry] of Object.entries(schema)) {
    if (!entry || typeof entry !== 'object') continue;
    result[key] = {
      type: isCustomPropertyType(entry.type) ? entry.type : 'string',
      options: Array.isArray(entry.options)
        ? entry.options.map(String)
        : undefined,
    };
  }
  return result;
}

function cloneValue(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map((item) => cloneValue(item));
  }
  if (value !== null && typeof value === 'object') {
    const obj: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      obj[k] = cloneValue(v);
    }
    return obj;
  }
  return value;
}

/** Infer a property type from a runtime value (used when loading legacy data). */
export function inferTypeFromValue(value: unknown): CustomPropertyType {
  if (typeof value === 'boolean') return 'boolean';
  if (typeof value === 'number' && Number.isFinite(value)) return 'number';
  if (Array.isArray(value)) return 'array';
  return 'string';
}

/**
 * Coerce an arbitrary value into a shape matching the declared type.
 * Returns a safe default when coercion is impossible.
 */
export function normalizePropertyValue(
  type: CustomPropertyType,
  value: unknown,
  options?: string[]
): unknown {
  switch (type) {
    case 'string':
      if (value === null || value === undefined) return '';
      if (typeof value === 'string') return value;
      if (typeof value === 'number' || typeof value === 'boolean') {
        return String(value);
      }
      try {
        return JSON.stringify(value);
      } catch {
        return '';
      }

    case 'number': {
      if (typeof value === 'number' && Number.isFinite(value)) return value;
      if (typeof value === 'string' && value.trim() !== '') {
        const n = Number(value);
        if (Number.isFinite(n)) return n;
      }
      return 0;
    }

    case 'boolean':
      if (typeof value === 'boolean') return value;
      if (value === 'true' || value === 1 || value === '1') return true;
      if (value === 'false' || value === 0 || value === '0') return false;
      return Boolean(value);

    case 'enum': {
      const str =
        value === null || value === undefined ? '' : String(value);
      if (options && options.length > 0) {
        return options.includes(str) ? str : options[0];
      }
      return str;
    }

    case 'array': {
      if (Array.isArray(value)) {
        return value.map((item) =>
          item === null || item === undefined ? '' : item
        );
      }
      if (typeof value === 'string') {
        const trimmed = value.trim();
        if (!trimmed) return [];
        try {
          const parsed = JSON.parse(trimmed);
          if (Array.isArray(parsed)) return parsed;
        } catch {
          // fall through — treat as single-line CSV
        }
        return trimmed
          .split(',')
          .map((s) => s.trim())
          .filter((s) => s.length > 0);
      }
      return [];
    }

    default:
      return value ?? null;
  }
}

/**
 * Validate a property key name.
 * Returns an error message, or null when valid.
 */
export function validatePropertyKey(
  key: string,
  existingKeys: Iterable<string>,
  options?: { excludeKey?: string }
): string | null {
  const trimmed = key.trim();
  if (!trimmed) {
    return 'Property name is required.';
  }
  if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(trimmed)) {
    return 'Use letters, numbers, and underscores; start with a letter or _.';
  }
  if (RESERVED_KEYS.has(trimmed)) {
    return `"${trimmed}" is a built-in field and cannot be used.`;
  }
  const exclude = options?.excludeKey;
  for (const existing of existingKeys) {
    if (existing === trimmed && existing !== exclude) {
      return `Property "${trimmed}" already exists.`;
    }
  }
  return null;
}

export function sanitizePropertyKey(key: string): string {
  return key.trim();
}

/** Parse raw project/export property bags into a consistent shape. */
export function parseNodeProperties(
  rawProperties: unknown,
  rawSchema: unknown
): {
  properties: Record<string, unknown>;
  propertySchema: Record<string, CustomPropertySchema>;
} {
  const properties = cloneProperties(
    rawProperties && typeof rawProperties === 'object'
      ? (rawProperties as Record<string, unknown>)
      : {}
  );

  const propertySchema = clonePropertySchema(
    rawSchema && typeof rawSchema === 'object'
      ? (rawSchema as Record<string, CustomPropertySchema>)
      : {}
  );

  // Ensure every value has schema; infer when missing (legacy / export re-import).
  for (const key of Object.keys(properties)) {
    if (!propertySchema[key]) {
      propertySchema[key] = {
        type: inferTypeFromValue(properties[key]),
      };
    }
    const schema = propertySchema[key];
    properties[key] = normalizePropertyValue(
      schema.type,
      properties[key],
      schema.options
    );
  }

  // Drop schema entries without a matching value.
  for (const key of Object.keys(propertySchema)) {
    if (!(key in properties)) {
      delete propertySchema[key];
    }
  }

  return { properties, propertySchema };
}

export function listPropertyKeys(node: GraphNode): string[] {
  return Object.keys(node.properties);
}

export function getPropertySchema(
  node: GraphNode,
  key: string
): CustomPropertySchema | undefined {
  return node.propertySchema[key];
}

export function getPropertyValue(node: GraphNode, key: string): unknown {
  return node.properties[key];
}

/**
 * Add a new custom property.
 * Throws if the key is invalid or already exists.
 */
export function addProperty(
  node: GraphNode,
  key: string,
  type: CustomPropertyType,
  options?: string[]
): GraphNode {
  const sanitized = sanitizePropertyKey(key);
  const error = validatePropertyKey(sanitized, Object.keys(node.properties));
  if (error) {
    throw new Error(error);
  }
  if (!isCustomPropertyType(type)) {
    throw new Error(`Unsupported property type: ${String(type)}`);
  }

  const enumOptions =
    type === 'enum'
      ? (options ?? []).map((o) => String(o).trim()).filter(Boolean)
      : undefined;

  if (type === 'enum' && (!enumOptions || enumOptions.length === 0)) {
    throw new Error('Enum properties require at least one option.');
  }

  const schema: CustomPropertySchema = {
    type,
    options: enumOptions,
  };

  return {
    ...node,
    properties: {
      ...node.properties,
      [sanitized]: defaultValueForType(type, enumOptions),
    },
    propertySchema: {
      ...node.propertySchema,
      [sanitized]: schema,
    },
  };
}

/**
 * Rename a property key while preserving value and schema.
 * Throws if the new key is invalid or collides.
 */
export function renameProperty(
  node: GraphNode,
  oldKey: string,
  newKey: string
): GraphNode {
  if (!(oldKey in node.properties)) {
    throw new Error(`Property "${oldKey}" does not exist.`);
  }

  const sanitized = sanitizePropertyKey(newKey);
  if (sanitized === oldKey) {
    return node;
  }

  const error = validatePropertyKey(sanitized, Object.keys(node.properties), {
    excludeKey: oldKey,
  });
  if (error) {
    throw new Error(error);
  }

  const properties: Record<string, unknown> = {};
  const propertySchema: Record<string, CustomPropertySchema> = {};

  // Preserve key insertion order.
  for (const key of Object.keys(node.properties)) {
    const targetKey = key === oldKey ? sanitized : key;
    properties[targetKey] = cloneValue(node.properties[key]);
    if (node.propertySchema[key]) {
      propertySchema[targetKey] = {
        ...node.propertySchema[key],
        options: node.propertySchema[key].options
          ? [...node.propertySchema[key].options!]
          : undefined,
      };
    }
  }

  return { ...node, properties, propertySchema };
}

/** Remove a custom property and its schema entry. */
export function deleteProperty(node: GraphNode, key: string): GraphNode {
  if (!(key in node.properties)) {
    return node;
  }

  const properties = { ...node.properties };
  const propertySchema = { ...node.propertySchema };
  delete properties[key];
  delete propertySchema[key];

  return { ...node, properties, propertySchema };
}

/** Update the value of an existing property (type-normalized). */
export function setPropertyValue(
  node: GraphNode,
  key: string,
  value: unknown
): GraphNode {
  if (!(key in node.properties)) {
    throw new Error(`Property "${key}" does not exist.`);
  }

  const schema = node.propertySchema[key] ?? {
    type: inferTypeFromValue(value),
  };
  const normalized = normalizePropertyValue(schema.type, value, schema.options);

  return {
    ...node,
    properties: {
      ...node.properties,
      [key]: normalized,
    },
    propertySchema: {
      ...node.propertySchema,
      [key]: schema,
    },
  };
}

/**
 * Change the type (and optional enum options) of an existing property.
 * Coerces the current value to the new type.
 */
export function setPropertySchema(
  node: GraphNode,
  key: string,
  schema: CustomPropertySchema
): GraphNode {
  if (!(key in node.properties)) {
    throw new Error(`Property "${key}" does not exist.`);
  }
  if (!isCustomPropertyType(schema.type)) {
    throw new Error(`Unsupported property type: ${String(schema.type)}`);
  }

  const options =
    schema.type === 'enum'
      ? (schema.options ?? [])
          .map((o) => String(o).trim())
          .filter(Boolean)
      : undefined;

  if (schema.type === 'enum' && (!options || options.length === 0)) {
    throw new Error('Enum properties require at least one option.');
  }

  const nextSchema: CustomPropertySchema = {
    type: schema.type,
    options,
  };

  const current = node.properties[key];
  const normalized = normalizePropertyValue(
    nextSchema.type,
    current,
    nextSchema.options
  );

  return {
    ...node,
    properties: {
      ...node.properties,
      [key]: normalized,
    },
    propertySchema: {
      ...node.propertySchema,
      [key]: nextSchema,
    },
  };
}

/** Clone a full node including nested property bags. */
export function cloneNode(node: GraphNode): GraphNode {
  return {
    ...node,
    properties: cloneProperties(node.properties),
    propertySchema: clonePropertySchema(node.propertySchema),
  };
}

/** Export-ready properties bag (deep-cloned values only). */
export function exportProperties(
  node: GraphNode
): Record<string, unknown> {
  return cloneProperties(node.properties);
}

/** Format an array property for text editing (one item per line). */
export function arrayToEditorText(value: unknown): string {
  if (!Array.isArray(value)) return '';
  return value.map((item) => {
    if (typeof item === 'string') return item;
    if (item === null || item === undefined) return '';
    try {
      return typeof item === 'object' ? JSON.stringify(item) : String(item);
    } catch {
      return String(item);
    }
  }).join('\n');
}

/** Parse multiline editor text into a string array. */
export function editorTextToArray(text: string): string[] {
  return text
    .split('\n')
    .map((line) => line.trimEnd())
    .filter((line, index, arr) => {
      // Keep empty middle lines? Drop trailing empties only.
      if (line.length > 0) return true;
      return index < arr.length - 1 && arr.slice(index + 1).some((l) => l.length > 0);
    })
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
}
