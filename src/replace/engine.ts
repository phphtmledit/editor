/*! @license GPL-2.0-or-later | https://github.com/phphtmledit/editor */
import {
  MAX_REPLACE_FIELD_LENGTH,
  MAX_REPLACE_RULES,
  type ReplaceRule,
  type ReplaceRuleError,
  type ReplaceRuleResult,
  type ReplaceRulesResult,
} from './types';

const ERROR_MESSAGES = {
  emptyFind: 'Строка поиска не может быть пустой.',
  findTooLong: `Строка поиска не может быть длиннее ${MAX_REPLACE_FIELD_LENGTH} символов.`,
  replacementTooLong: `Строка замены не может быть длиннее ${MAX_REPLACE_FIELD_LENGTH} символов.`,
  invalidRegex: 'Некорректное регулярное выражение.',
} as const;

const error = (code: ReplaceRuleError['code'], message: string): ReplaceRuleError => ({
  code,
  message,
});

export const validateReplaceRule = (rule: ReplaceRule): ReplaceRuleError | null => {
  if (rule.find.length === 0) return error('empty-find', ERROR_MESSAGES.emptyFind);
  if (rule.find.length > MAX_REPLACE_FIELD_LENGTH) {
    return error('find-too-long', ERROR_MESSAGES.findTooLong);
  }
  if (rule.replacement.length > MAX_REPLACE_FIELD_LENGTH) {
    return error('replacement-too-long', ERROR_MESSAGES.replacementTooLong);
  }
  return null;
};

const escapeRegExp = (value: string): string => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const compileRegex = (rule: ReplaceRule): RegExp | ReplaceRuleError => {
  try {
    return new RegExp(rule.isRegex ? rule.find : escapeRegExp(rule.find), rule.ignoreCase ? 'gi' : 'g');
  } catch {
    return error('invalid-regex', ERROR_MESSAGES.invalidRegex);
  }
};

export const validateReplaceRegex = (rule: ReplaceRule): ReplaceRuleError | null => {
  const validationError = validateReplaceRule(rule);
  if (validationError || !rule.isRegex) return validationError;
  const compiled = compileRegex(rule);
  return compiled instanceof RegExp ? null : compiled;
};

const countRegexMatches = (html: string, regex: RegExp): number => {
  let count = 0;
  let match: RegExpExecArray | null;
  regex.lastIndex = 0;

  while ((match = regex.exec(html)) !== null) {
    count += 1;
    if (match[0].length === 0) regex.lastIndex += 1;
  }

  regex.lastIndex = 0;
  return count;
};

export const applyReplaceRule = (html: string, rule: ReplaceRule): ReplaceRuleResult => {
  const validationError = validateReplaceRule(rule);
  if (validationError) return { html, count: 0, error: validationError };

  const regex = compileRegex(rule);
  if (!(regex instanceof RegExp)) return { html, count: 0, error: regex };

  if (rule.isRegex) {
    const count = countRegexMatches(html, regex);
    return {
      html: count === 0 ? html : html.replace(regex, rule.replacement),
      count,
      error: null,
    };
  }

  let count = 0;
  return {
    html: html.replace(regex, () => {
      count += 1;
      return rule.replacement;
    }),
    count,
    error: null,
  };
};

export const applyReplaceRules = (
  html: string,
  rules: readonly ReplaceRule[],
): ReplaceRulesResult => {
  const applicableRules = rules.slice(0, MAX_REPLACE_RULES);
  const results: ReplaceRulesResult['results'] = [];
  let currentHtml = html;
  let count = 0;

  applicableRules.forEach((rule, ruleIndex) => {
    const result = applyReplaceRule(currentHtml, rule);
    currentHtml = result.html;
    count += result.count;
    results.push({
      ruleId: rule.id,
      ruleIndex,
      count: result.count,
      error: result.error,
    });
  });

  return {
    html: currentHtml,
    count,
    results,
    ignoredRuleCount: rules.length - applicableRules.length,
  };
};
