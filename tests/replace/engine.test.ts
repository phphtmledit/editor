/*! @license GPL-2.0-or-later | https://github.com/phphtmledit/editor */
import { describe, expect, it } from 'vitest';
import {
  applyReplaceRule,
  applyReplaceRules,
  MAX_REPLACE_FIELD_LENGTH,
  type ReplaceRule,
} from '../../src/replace';

const rule = (overrides: Partial<ReplaceRule> = {}): ReplaceRule => ({
  id: 'rule-1',
  find: 'cat',
  replacement: 'dog',
  isRegex: false,
  ignoreCase: false,
  ...overrides,
});

describe('applyReplaceRule', () => {
  it('replaces every literal match and treats replacement tokens literally', () => {
    const result = applyReplaceRule(
      '<p>cat .*</p><p>cat</p>',
      rule({ find: 'cat', replacement: '$&-$1-$$' }),
    );

    expect(result).toEqual({
      html: '<p>$&-$1-$$ .*</p><p>$&-$1-$$</p>',
      count: 2,
      error: null,
    });
  });

  it('escapes regular-expression metacharacters in a literal search', () => {
    const result = applyReplaceRule('a.b aab a.b', rule({ find: 'a.b', replacement: 'x' }));

    expect(result.html).toBe('x aab x');
    expect(result.count).toBe(2);
  });

  it('applies case-insensitive literal replacement when requested', () => {
    const result = applyReplaceRule('Cat CAT cat', rule({ ignoreCase: true }));

    expect(result.html).toBe('dog dog dog');
    expect(result.count).toBe(3);
  });

  it('uses standard JavaScript capture and whole-match templates for regex replacement', () => {
    const result = applyReplaceRule(
      '<p>alpha-12 beta-7</p>',
      rule({
        find: '([a-z]+)-(\\d+)',
        replacement: '$2:$1:$&',
        isRegex: true,
      }),
    );

    expect(result.html).toBe('<p>12:alpha:alpha-12 7:beta:beta-7</p>');
    expect(result.count).toBe(2);
  });

  it('applies the ignore-case flag to regular expressions', () => {
    const result = applyReplaceRule(
      'Cat CAT cat',
      rule({ find: 'cat', replacement: 'dog', isRegex: true, ignoreCase: true }),
    );

    expect(result.html).toBe('dog dog dog');
    expect(result.count).toBe(3);
  });

  it('counts zero-width regex matches without looping forever', () => {
    const result = applyReplaceRule(
      'aa',
      rule({ find: '(?=a)', replacement: '_', isRegex: true }),
    );

    expect(result.html).toBe('_a_a');
    expect(result.count).toBe(2);
  });

  it('reports a match even when replacement leaves the string unchanged', () => {
    const result = applyReplaceRule('cat', rule({ replacement: 'cat' }));

    expect(result.html).toBe('cat');
    expect(result.count).toBe(1);
  });

  it('returns an invalid regex as data and leaves the HTML untouched', () => {
    const result = applyReplaceRule(
      '<p>safe</p>',
      rule({ find: '([a-z]+', replacement: 'unsafe', isRegex: true }),
    );

    expect(result.html).toBe('<p>safe</p>');
    expect(result.count).toBe(0);
    expect(result.error?.code).toBe('invalid-regex');
  });

  it('rejects empty and oversized fields without changing the HTML', () => {
    const empty = applyReplaceRule('<p>safe</p>', rule({ find: '' }));
    const longFind = applyReplaceRule(
      '<p>safe</p>',
      rule({ find: 'x'.repeat(MAX_REPLACE_FIELD_LENGTH + 1) }),
    );
    const longReplacement = applyReplaceRule(
      '<p>safe</p>',
      rule({ replacement: 'x'.repeat(MAX_REPLACE_FIELD_LENGTH + 1) }),
    );

    expect(empty.error?.code).toBe('empty-find');
    expect(longFind.error?.code).toBe('find-too-long');
    expect(longReplacement.error?.code).toBe('replacement-too-long');
    expect([empty.html, longFind.html, longReplacement.html]).toEqual([
      '<p>safe</p>',
      '<p>safe</p>',
      '<p>safe</p>',
    ]);
  });
});

describe('applyReplaceRules', () => {
  it('applies rules in order and reports exact per-rule and total counts', () => {
    const result = applyReplaceRules('cat cat', [
      rule({ id: 'cats-to-dogs', replacement: 'dog' }),
      rule({ id: 'dogs-to-foxes', find: 'dog', replacement: 'fox' }),
    ]);

    expect(result.html).toBe('fox fox');
    expect(result.count).toBe(4);
    expect(result.results.map(({ ruleId, ruleIndex, count }) => ({ ruleId, ruleIndex, count })))
      .toEqual([
        { ruleId: 'cats-to-dogs', ruleIndex: 0, count: 2 },
        { ruleId: 'dogs-to-foxes', ruleIndex: 1, count: 2 },
      ]);
  });

  it('continues with valid rules after an invalid regex', () => {
    const result = applyReplaceRules('cat', [
      rule({ id: 'invalid', find: '[', isRegex: true }),
      rule({ id: 'valid', replacement: 'dog' }),
    ]);

    expect(result.html).toBe('dog');
    expect(result.count).toBe(1);
    expect(result.results[0]?.error?.code).toBe('invalid-regex');
    expect(result.results[1]?.error).toBeNull();
  });

  it('never applies more than the ten-rule product limit', () => {
    const rules = Array.from({ length: 11 }, (_, index) =>
      rule({ id: `rule-${index}`, find: `[token-${index}]`, replacement: 'changed' }),
    );
    const result = applyReplaceRules('[token-10]', rules);

    expect(result.html).toBe('[token-10]');
    expect(result.results).toHaveLength(10);
    expect(result.ignoredRuleCount).toBe(1);
  });
});
