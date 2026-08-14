/*! @license GPL-2.0-or-later | https://github.com/phphtmledit/editor */
import { REPLACE_STORAGE_ERRORS } from '../ui/strings';
import {
  MAX_REPLACE_FIELD_LENGTH,
  MAX_REPLACE_RULE_ID_LENGTH,
  MAX_REPLACE_RULES,
  type ReplaceRule,
} from './types';

export const REPLACE_RULES_STORAGE_VERSION = 1;
export const REPLACE_RULES_STORAGE_KEY = 'phphtmledit.replace-rules.v1';
export const MAX_REPLACE_STORAGE_LENGTH = 1_048_576;

export type ReplaceRulesStorageErrorCode =
  | 'too-large'
  | 'invalid-json'
  | 'unsupported-version'
  | 'invalid-schema'
  | 'storage-read-failed'
  | 'storage-write-failed';

export interface ReplaceRulesStorageError {
  code: ReplaceRulesStorageErrorCode;
  message: string;
}

export type ParseReplaceRulesResult =
  | { ok: true; rules: ReplaceRule[] }
  | { ok: false; error: ReplaceRulesStorageError };

export type SerializeReplaceRulesResult =
  | { ok: true; value: string }
  | { ok: false; error: ReplaceRulesStorageError };

export type SaveReplaceRulesResult =
  | { ok: true }
  | { ok: false; error: ReplaceRulesStorageError };

export interface ReplaceRulesStorage {
  getItem: (key: string) => string | null;
  setItem: (key: string, value: string) => void;
}

const failure = (
  code: ReplaceRulesStorageErrorCode,
  message: string,
): { ok: false; error: ReplaceRulesStorageError } => ({
  ok: false,
  error: { code, message },
});

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const parseRule = (value: unknown): ReplaceRule | null => {
  if (!isRecord(value)) return null;

  const { id, find, replacement, isRegex, ignoreCase } = value;
  if (
    typeof id !== 'string' ||
    id.length === 0 ||
    id.length > MAX_REPLACE_RULE_ID_LENGTH ||
    typeof find !== 'string' ||
    find.length > MAX_REPLACE_FIELD_LENGTH ||
    typeof replacement !== 'string' ||
    replacement.length > MAX_REPLACE_FIELD_LENGTH ||
    typeof isRegex !== 'boolean' ||
    typeof ignoreCase !== 'boolean'
  ) {
    return null;
  }

  return { id, find, replacement, isRegex, ignoreCase };
};

const validateRules = (value: unknown): ParseReplaceRulesResult => {
  if (!Array.isArray(value) || value.length > MAX_REPLACE_RULES) {
    return failure('invalid-schema', REPLACE_STORAGE_ERRORS.storedInvalidSchema);
  }

  const rules: ReplaceRule[] = [];
  const ids = new Set<string>();
  for (const candidate of value) {
    const rule = parseRule(candidate);
    if (!rule || ids.has(rule.id)) {
      return failure('invalid-schema', REPLACE_STORAGE_ERRORS.storedInvalidSchema);
    }
    ids.add(rule.id);
    rules.push(rule);
  }

  return { ok: true, rules };
};

export const parseStoredReplaceRules = (value: string | null): ParseReplaceRulesResult => {
  if (value === null) return { ok: true, rules: [] };
  if (value.length > MAX_REPLACE_STORAGE_LENGTH) {
    return failure('too-large', REPLACE_STORAGE_ERRORS.storedTooLarge);
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(value) as unknown;
  } catch {
    return failure('invalid-json', REPLACE_STORAGE_ERRORS.storedInvalidJson);
  }

  if (!isRecord(parsed)) {
    return failure('invalid-schema', REPLACE_STORAGE_ERRORS.storedInvalidSchema);
  }
  if (parsed.version !== REPLACE_RULES_STORAGE_VERSION) {
    return failure('unsupported-version', REPLACE_STORAGE_ERRORS.unsupportedVersion);
  }

  return validateRules(parsed.rules);
};

export const serializeReplaceRules = (
  rules: readonly ReplaceRule[],
): SerializeReplaceRulesResult => {
  const validated = validateRules(rules);
  if (!validated.ok) return validated;

  const value = JSON.stringify({
    version: REPLACE_RULES_STORAGE_VERSION,
    rules: validated.rules,
  });
  if (value.length > MAX_REPLACE_STORAGE_LENGTH) {
    return failure('too-large', REPLACE_STORAGE_ERRORS.currentTooLarge);
  }

  return { ok: true, value };
};

export const loadReplaceRules = (
  storage?: ReplaceRulesStorage,
): ParseReplaceRulesResult => {
  try {
    const target = storage ?? globalThis.localStorage;
    return parseStoredReplaceRules(target.getItem(REPLACE_RULES_STORAGE_KEY));
  } catch {
    return failure('storage-read-failed', REPLACE_STORAGE_ERRORS.readFailed);
  }
};

export const saveReplaceRules = (
  rules: readonly ReplaceRule[],
  storage?: ReplaceRulesStorage,
): SaveReplaceRulesResult => {
  const serialized = serializeReplaceRules(rules);
  if (!serialized.ok) return serialized;

  try {
    const target = storage ?? globalThis.localStorage;
    target.setItem(REPLACE_RULES_STORAGE_KEY, serialized.value);
    return { ok: true };
  } catch {
    return failure('storage-write-failed', REPLACE_STORAGE_ERRORS.writeFailed);
  }
};
