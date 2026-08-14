/*! @license GPL-2.0-or-later | https://github.com/phphtmledit/editor */
import { REPLACE_RULE_ERRORS } from '../ui/strings';
import { applyReplaceRule, validateReplaceRegex } from './engine';
import {
  MAX_REPLACE_RULES,
  type ReplaceRule,
  type ReplaceRuleError,
  type ReplaceRuleResult,
  type ReplaceRulesResult,
} from './types';
import type { RegexWorkerRequest, RegexWorkerResponse } from './worker-protocol';

export const REGEX_WORKER_TIMEOUT_MS = 500;

const failure = (
  html: string,
  code: 'regex-timeout' | 'regex-worker-failed',
  message: string,
): ReplaceRuleResult => ({
  html,
  count: 0,
  error: { code, message },
});

const isWorkerResult = (value: unknown): value is ReplaceRuleResult => {
  if (typeof value !== 'object' || value === null) return false;
  const result = value as Partial<ReplaceRuleResult>;
  if (
    typeof result.html !== 'string' ||
    typeof result.count !== 'number' ||
    !Number.isInteger(result.count) ||
    result.count < 0
  ) return false;
  if (result.error === null) return true;
  return typeof result.error === 'object' &&
    result.error !== null &&
    typeof (result.error as Partial<ReplaceRuleError>).code === 'string' &&
    typeof (result.error as Partial<ReplaceRuleError>).message === 'string';
};

const runRegexWorker = (html: string, rule: ReplaceRule): Promise<ReplaceRuleResult> => {
  let worker: Worker;
  try {
    worker = new Worker(new URL('./regex-worker.ts', import.meta.url), {
      type: 'module',
      name: 'phphtmledit-regex',
    });
  } catch {
    return Promise.resolve(failure(
      html,
      'regex-worker-failed',
      REPLACE_RULE_ERRORS.workerStartFailed,
    ));
  }

  return new Promise((resolve) => {
    let settled = false;
    const finish = (result: ReplaceRuleResult): void => {
      if (settled) return;
      settled = true;
      window.clearTimeout(timeout);
      worker.onmessage = null;
      worker.onerror = null;
      worker.onmessageerror = null;
      worker.terminate();
      resolve(result);
    };
    const workerFailure = (): void => finish(failure(
      html,
      'regex-worker-failed',
      REPLACE_RULE_ERRORS.workerExecutionFailed,
    ));
    const timeout = window.setTimeout(() => finish(failure(
      html,
      'regex-timeout',
      REPLACE_RULE_ERRORS.workerTimedOut(REGEX_WORKER_TIMEOUT_MS),
    )), REGEX_WORKER_TIMEOUT_MS);

    worker.onmessage = (event: MessageEvent<RegexWorkerResponse>): void => {
      const response = event.data;
      if (response?.ok === true && isWorkerResult(response.result)) finish(response.result);
      else workerFailure();
    };
    worker.onerror = (event): void => {
      event.preventDefault();
      workerFailure();
    };
    worker.onmessageerror = workerFailure;

    try {
      const request: RegexWorkerRequest = { html, rule };
      worker.postMessage(request);
    } catch {
      workerFailure();
    }
  });
};

export const applyReplaceRuleSafe = async (
  html: string,
  rule: ReplaceRule,
): Promise<ReplaceRuleResult> => {
  if (!rule.isRegex) return applyReplaceRule(html, rule);
  const validationError = validateReplaceRegex(rule);
  if (validationError) return { html, count: 0, error: validationError };
  return runRegexWorker(html, rule);
};

export const applyReplaceRulesSafe = async (
  html: string,
  rules: readonly ReplaceRule[],
): Promise<ReplaceRulesResult> => {
  const applicableRules = rules.slice(0, MAX_REPLACE_RULES);
  const results: ReplaceRulesResult['results'] = [];
  let currentHtml = html;
  let count = 0;

  for (const [ruleIndex, rule] of applicableRules.entries()) {
    const result = await applyReplaceRuleSafe(currentHtml, rule);
    currentHtml = result.html;
    count += result.count;
    results.push({
      ruleId: rule.id,
      ruleIndex,
      count: result.count,
      error: result.error,
    });
  }

  return {
    html: currentHtml,
    count,
    results,
    ignoredRuleCount: rules.length - applicableRules.length,
  };
};
