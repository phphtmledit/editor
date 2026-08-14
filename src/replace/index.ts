/*! @license GPL-2.0-or-later | https://github.com/phphtmledit/editor */
export {
  applyReplaceRule,
  applyReplaceRules,
  validateReplaceRegex,
  validateReplaceRule,
} from './engine';
export {
  loadReplaceRules,
  MAX_REPLACE_STORAGE_LENGTH,
  parseStoredReplaceRules,
  REPLACE_RULES_STORAGE_KEY,
  REPLACE_RULES_STORAGE_VERSION,
  saveReplaceRules,
  serializeReplaceRules,
} from './storage';
export {
  MAX_REPLACE_FIELD_LENGTH,
  MAX_REPLACE_RULE_ID_LENGTH,
  MAX_REPLACE_RULES,
} from './types';
export type {
  ParseReplaceRulesResult,
  ReplaceRulesStorage,
  ReplaceRulesStorageError,
  ReplaceRulesStorageErrorCode,
  SaveReplaceRulesResult,
  SerializeReplaceRulesResult,
} from './storage';
export type {
  ReplaceRule,
  ReplaceRuleBatchEntry,
  ReplaceRuleError,
  ReplaceRuleErrorCode,
  ReplaceRuleResult,
  ReplaceRulesResult,
} from './types';
