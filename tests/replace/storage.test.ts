/*! @license GPL-2.0-or-later | https://github.com/phphtmledit/editor */
import { describe, expect, it, vi } from 'vitest';
import {
  loadReplaceRules,
  MAX_REPLACE_FIELD_LENGTH,
  MAX_REPLACE_RULES,
  MAX_REPLACE_STORAGE_LENGTH,
  parseStoredReplaceRules,
  REPLACE_RULES_STORAGE_KEY,
  REPLACE_RULES_STORAGE_VERSION,
  saveReplaceRules,
  serializeReplaceRules,
  type ReplaceRule,
  type ReplaceRulesStorage,
} from '../../src/replace';

const rule = (overrides: Partial<ReplaceRule> = {}): ReplaceRule => ({
  id: 'rule-1',
  find: 'before',
  replacement: 'after',
  isRegex: false,
  ignoreCase: false,
  ...overrides,
});

const memoryStorage = (): ReplaceRulesStorage & { values: Map<string, string> } => {
  const values = new Map<string, string>();
  return {
    values,
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => {
      values.set(key, value);
    },
  };
};

describe('replace-rule serialization', () => {
  it('round-trips an ordered rule set with an explicit schema version', () => {
    const rules = [
      rule(),
      rule({ id: 'rule-2', find: '(cat)', replacement: '$1', isRegex: true, ignoreCase: true }),
    ];
    const serialized = serializeReplaceRules(rules);

    expect(serialized.ok).toBe(true);
    if (!serialized.ok) return;
    expect(JSON.parse(serialized.value)).toMatchObject({
      version: REPLACE_RULES_STORAGE_VERSION,
    });
    expect(parseStoredReplaceRules(serialized.value)).toEqual({ ok: true, rules });
  });

  it('treats a missing storage entry as an empty rule set', () => {
    expect(parseStoredReplaceRules(null)).toEqual({ ok: true, rules: [] });
  });

  it('returns malformed JSON, schema, and unsupported versions as data errors', () => {
    const malformed = parseStoredReplaceRules('{');
    const wrongSchema = parseStoredReplaceRules(JSON.stringify({ version: 1, rules: 'not-an-array' }));
    const wrongVersion = parseStoredReplaceRules(JSON.stringify({ version: 2, rules: [] }));

    expect(malformed.ok ? null : malformed.error.code).toBe('invalid-json');
    expect(wrongSchema.ok ? null : wrongSchema.error.code).toBe('invalid-schema');
    expect(wrongVersion.ok ? null : wrongVersion.error.code).toBe('unsupported-version');
  });

  it('rejects duplicate ids, too many rules, and oversized fields atomically', () => {
    const duplicates = serializeReplaceRules([rule(), rule()]);
    const tooMany = serializeReplaceRules(
      Array.from({ length: MAX_REPLACE_RULES + 1 }, (_, index) => rule({ id: `rule-${index}` })),
    );
    const oversized = serializeReplaceRules([
      rule({ find: 'x'.repeat(MAX_REPLACE_FIELD_LENGTH + 1) }),
    ]);

    expect(duplicates.ok ? null : duplicates.error.code).toBe('invalid-schema');
    expect(tooMany.ok ? null : tooMany.error.code).toBe('invalid-schema');
    expect(oversized.ok ? null : oversized.error.code).toBe('invalid-schema');
  });

  it('rejects a payload before parsing when its bounded size is exceeded', () => {
    const result = parseStoredReplaceRules('x'.repeat(MAX_REPLACE_STORAGE_LENGTH + 1));

    expect(result.ok ? null : result.error.code).toBe('too-large');
  });
});

describe('localStorage boundary', () => {
  it('uses the versioned product key to save and load rules', () => {
    const storage = memoryStorage();
    const rules = [rule()];

    expect(saveReplaceRules(rules, storage)).toEqual({ ok: true });
    expect(storage.values.has(REPLACE_RULES_STORAGE_KEY)).toBe(true);
    expect(loadReplaceRules(storage)).toEqual({ ok: true, rules });
  });

  it('turns privacy and quota exceptions into non-throwing errors', () => {
    const readFailure: ReplaceRulesStorage = {
      getItem: () => {
        throw new DOMException('blocked', 'SecurityError');
      },
      setItem: vi.fn(),
    };
    const writeFailure: ReplaceRulesStorage = {
      getItem: () => null,
      setItem: () => {
        throw new DOMException('full', 'QuotaExceededError');
      },
    };

    const loaded = loadReplaceRules(readFailure);
    const saved = saveReplaceRules([rule()], writeFailure);

    expect(loaded.ok ? null : loaded.error.code).toBe('storage-read-failed');
    expect(saved.ok ? null : saved.error.code).toBe('storage-write-failed');
  });

  it('does not write a rule set that fails validation', () => {
    const storage = memoryStorage();
    const setItem = vi.spyOn(storage, 'setItem');
    const result = saveReplaceRules([
      rule({ find: 'x'.repeat(MAX_REPLACE_FIELD_LENGTH + 1) }),
    ], storage);

    expect(result.ok).toBe(false);
    expect(setItem).not.toHaveBeenCalled();
  });
});
