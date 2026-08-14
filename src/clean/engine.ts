/*! @license GPL-2.0-or-later | https://github.com/phphtmledit/editor */

import { createDetachedRoot } from './dom';
import { CLEAN_RULES_BY_ID, DEFAULT_CLEAN_RULE_IDS } from './rules';
import type { CleanResult, CleanRule, CleanRuleId } from './types';

export type CleanYield = (
  completedRuleId: CleanRuleId,
  completedRuleCount: number,
  totalRuleCount: number,
) => void | Promise<void>;

const CLEAN_RULE_EXECUTION_ORDER: readonly CleanRuleId[] = [
  'word-junk',
  'inline-styles',
  'classes-and-ids',
  'comments',
  'tag-attributes',
  'ai-symbols',
  'repeated-spaces',
  'single-space-elements',
  'empty-elements',
  'plain-text',
];

function orderedRulesFor(ruleIds: readonly CleanRuleId[]): CleanRule[] {
  const requestedRuleIds = new Set(ruleIds);
  const orderedRules = CLEAN_RULE_EXECUTION_ORDER
    .filter((ruleId) => requestedRuleIds.has(ruleId))
    .map((ruleId) => CLEAN_RULES_BY_ID.get(ruleId))
    .filter((rule) => rule !== undefined);
  if (orderedRules.length !== requestedRuleIds.size) {
    throw new Error('Unknown HTML cleaning rule.');
  }
  return orderedRules;
}

function resultFor(html: string, root: HTMLElement, orderedRules: readonly CleanRule[]): CleanResult {
  const cleanedHtml = root.innerHTML;
  return {
    html: cleanedHtml,
    changed: cleanedHtml !== html,
    appliedRuleIds: orderedRules.map((rule) => rule.id),
  };
}

function runRules(html: string, ruleIds: readonly CleanRuleId[]): CleanResult {
  if (ruleIds.length === 0) {
    return { html, changed: false, appliedRuleIds: [] };
  }

  const orderedRules = orderedRulesFor(ruleIds);

  const root = createDetachedRoot(html);
  for (const rule of orderedRules) {
    rule.apply(root);
  }
  return resultFor(html, root, orderedRules);
}

const yieldToEventLoop: CleanYield = () => new Promise((resolve) => {
  globalThis.setTimeout(resolve, 0);
});

export function cleanHtml(
  html: string,
  ruleIds: readonly CleanRuleId[] = DEFAULT_CLEAN_RULE_IDS,
): CleanResult {
  return runRules(html, ruleIds);
}

/**
 * Runs all requested rules against one detached DOM while yielding between
 * rule passes. A single rule remains atomic; the complete cleaning operation
 * no longer monopolizes one browser task.
 */
export async function cleanHtmlCooperatively(
  html: string,
  ruleIds: readonly CleanRuleId[] = DEFAULT_CLEAN_RULE_IDS,
  yieldControl: CleanYield = yieldToEventLoop,
): Promise<CleanResult> {
  if (ruleIds.length === 0) {
    return { html, changed: false, appliedRuleIds: [] };
  }

  const orderedRules = orderedRulesFor(ruleIds);
  const root = createDetachedRoot(html);
  for (const [index, rule] of orderedRules.entries()) {
    rule.apply(root);
    if (index < orderedRules.length - 1) {
      await yieldControl(rule.id, index + 1, orderedRules.length);
    }
  }
  return resultFor(html, root, orderedRules);
}

export function applyCleanRule(html: string, ruleId: CleanRuleId): CleanResult {
  if (!CLEAN_RULES_BY_ID.has(ruleId)) {
    throw new Error(`Unknown HTML cleaning rule: ${String(ruleId)}`);
  }
  return runRules(html, [ruleId]);
}
