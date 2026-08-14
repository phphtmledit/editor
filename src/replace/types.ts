/*! @license GPL-2.0-or-later | https://github.com/phphtmledit/editor */

export const MAX_REPLACE_RULES = 10;
export const MAX_REPLACE_RULE_ID_LENGTH = 128;
export const MAX_REPLACE_FIELD_LENGTH = 8_192;

export interface ReplaceRule {
  id: string;
  find: string;
  replacement: string;
  isRegex: boolean;
  ignoreCase: boolean;
}

export type ReplaceRuleErrorCode =
  | 'empty-find'
  | 'find-too-long'
  | 'replacement-too-long'
  | 'invalid-regex'
  | 'regex-timeout'
  | 'regex-worker-failed';

export interface ReplaceRuleError {
  code: ReplaceRuleErrorCode;
  message: string;
}

export interface ReplaceRuleResult {
  html: string;
  count: number;
  error: ReplaceRuleError | null;
}

export interface ReplaceRuleBatchEntry {
  ruleId: string;
  ruleIndex: number;
  count: number;
  error: ReplaceRuleError | null;
}

export interface ReplaceRulesResult {
  html: string;
  count: number;
  results: ReplaceRuleBatchEntry[];
  ignoredRuleCount: number;
}
