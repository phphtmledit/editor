/*! @license GPL-2.0-or-later | https://github.com/phphtmledit/editor */

import type { CleanRule, CleanRuleId } from '../types';
import { aiSymbolsRule } from './ai-symbols';
import { classesAndIdsRule } from './classes-and-ids';
import { commentsRule } from './comments';
import { emptyElementsRule } from './empty-elements';
import { inlineStylesRule } from './inline-styles';
import { plainTextRule } from './plain-text';
import { repeatedSpacesRule } from './repeated-spaces';
import { singleSpaceElementsRule } from './single-space-elements';
import { tagAttributesRule } from './tag-attributes';
import { wordJunkRule } from './word-junk';

export const CLEAN_RULES: readonly CleanRule[] = [
  inlineStylesRule,
  classesAndIdsRule,
  emptyElementsRule,
  singleSpaceElementsRule,
  repeatedSpacesRule,
  commentsRule,
  tagAttributesRule,
  plainTextRule,
  aiSymbolsRule,
  wordJunkRule,
];

export const DEFAULT_CLEAN_RULE_IDS: readonly CleanRuleId[] = CLEAN_RULES
  .filter((rule) => rule.enabledByDefault)
  .map((rule) => rule.id);

export const CLEAN_RULES_BY_ID = new Map<CleanRuleId, CleanRule>(
  CLEAN_RULES.map((rule) => [rule.id, rule]),
);

export {
  aiSymbolsRule,
  classesAndIdsRule,
  commentsRule,
  emptyElementsRule,
  inlineStylesRule,
  plainTextRule,
  repeatedSpacesRule,
  singleSpaceElementsRule,
  tagAttributesRule,
  wordJunkRule,
};
