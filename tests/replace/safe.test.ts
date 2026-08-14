/*! @license GPL-2.0-or-later | https://github.com/phphtmledit/editor */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { applyReplaceRule } from '../../src/replace';
import {
  applyReplaceRuleSafe,
  applyReplaceRulesSafe,
  REGEX_WORKER_TIMEOUT_MS,
} from '../../src/replace/safe';
import type { RegexWorkerRequest, RegexWorkerResponse } from '../../src/replace/worker-protocol';
import type { ReplaceRule } from '../../src/replace';

type WorkerBehavior = 'success' | 'error' | 'hang';

class FakeWorker {
  static behaviors: WorkerBehavior[] = [];
  static instances: FakeWorker[] = [];

  onmessage: Worker['onmessage'] = null;
  onerror: Worker['onerror'] = null;
  onmessageerror: Worker['onmessageerror'] = null;
  readonly terminate = vi.fn();
  private readonly behavior: WorkerBehavior;

  constructor() {
    this.behavior = FakeWorker.behaviors.shift() ?? 'success';
    FakeWorker.instances.push(this);
  }

  postMessage(request: RegexWorkerRequest): void {
    if (this.behavior === 'hang') return;
    queueMicrotask(() => {
      if (this.behavior === 'error') {
        this.onerror?.call(
          this as unknown as Worker,
          new ErrorEvent('error', { message: 'worker failed' }),
        );
        return;
      }
      const response: RegexWorkerResponse = {
        ok: true,
        result: applyReplaceRule(request.html, request.rule),
      };
      this.onmessage?.call(
        this as unknown as Worker,
        new MessageEvent('message', { data: response }),
      );
    });
  }
}

const rule = (overrides: Partial<ReplaceRule> = {}): ReplaceRule => ({
  id: 'rule-1',
  find: 'cat',
  replacement: 'dog',
  isRegex: true,
  ignoreCase: false,
  ...overrides,
});

describe('safe regular-expression replacement', () => {
  beforeEach(() => {
    FakeWorker.behaviors = [];
    FakeWorker.instances = [];
    vi.stubGlobal('Worker', FakeWorker);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('runs a valid regex in a worker and terminates it after the result', async () => {
    const result = await applyReplaceRuleSafe('cat cat', rule());

    expect(result).toEqual({ html: 'dog dog', count: 2, error: null });
    expect(FakeWorker.instances).toHaveLength(1);
    expect(FakeWorker.instances[0]?.terminate).toHaveBeenCalledOnce();
  });

  it('reports invalid syntax before creating a worker', async () => {
    const result = await applyReplaceRuleSafe('cat', rule({ find: '[' }));

    expect(result.error?.code).toBe('invalid-regex');
    expect(result.html).toBe('cat');
    expect(FakeWorker.instances).toHaveLength(0);
  });

  it('terminates a hanging regex at the hard timeout and returns a data error', async () => {
    vi.useFakeTimers();
    FakeWorker.behaviors = ['hang'];
    const pending = applyReplaceRuleSafe('a'.repeat(100_000), rule({ find: '(a+)+$' }));

    await vi.advanceTimersByTimeAsync(REGEX_WORKER_TIMEOUT_MS);
    const result = await pending;

    expect(result.error?.code).toBe('regex-timeout');
    expect(result.html).toBe('a'.repeat(100_000));
    expect(FakeWorker.instances[0]?.terminate).toHaveBeenCalledOnce();
  });

  it('continues a batch in order after a worker error', async () => {
    FakeWorker.behaviors = ['error'];
    const result = await applyReplaceRulesSafe('cat', [
      rule({ id: 'failed-regex' }),
      rule({ id: 'literal', find: 'cat', replacement: 'fox', isRegex: false }),
    ]);

    expect(result.html).toBe('fox');
    expect(result.count).toBe(1);
    expect(result.results[0]?.error?.code).toBe('regex-worker-failed');
    expect(result.results[1]).toMatchObject({ ruleId: 'literal', count: 1, error: null });
  });

  it('continues a batch in order after a timeout', async () => {
    vi.useFakeTimers();
    FakeWorker.behaviors = ['hang'];
    const pending = applyReplaceRulesSafe('cat', [
      rule({ id: 'timed-out-regex', find: '(a+)+$' }),
      rule({ id: 'literal', find: 'cat', replacement: 'fox', isRegex: false }),
    ]);

    await vi.advanceTimersByTimeAsync(REGEX_WORKER_TIMEOUT_MS);
    const result = await pending;

    expect(result.html).toBe('fox');
    expect(result.count).toBe(1);
    expect(result.results[0]?.error?.code).toBe('regex-timeout');
    expect(result.results[1]).toMatchObject({ ruleId: 'literal', count: 1, error: null });
  });
});
