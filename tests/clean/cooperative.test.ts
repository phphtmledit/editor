import { describe, expect, it, vi } from 'vitest';
import { cleanHtml, cleanHtmlCooperatively, type CleanRuleId } from '../../src/clean';

describe('cooperative cleaning', () => {
  it('uses one ordered result while yielding between rule passes', async () => {
    const input = '<!--note--><p class="MsoNormal keep" style="color:red">A&nbsp;&nbsp;B</p>';
    const ruleIds: CleanRuleId[] = [
      'inline-styles',
      'classes-and-ids',
      'comments',
      'repeated-spaces',
      'word-junk',
    ];
    const yieldControl = vi.fn(async () => Promise.resolve());

    const cooperative = await cleanHtmlCooperatively(input, ruleIds, yieldControl);

    expect(cooperative).toEqual(cleanHtml(input, ruleIds));
    expect(yieldControl).toHaveBeenCalledTimes(ruleIds.length - 1);
    expect(yieldControl.mock.calls.map(([ruleId]) => ruleId)).toEqual([
      'word-junk',
      'inline-styles',
      'classes-and-ids',
      'comments',
    ]);
  });

  it('remains idempotent after cooperative execution', async () => {
    const input = '<p style="color:red">“A”&nbsp;&nbsp;— B</p>';
    const first = await cleanHtmlCooperatively(input, undefined, async () => Promise.resolve());
    const second = await cleanHtmlCooperatively(first.html, undefined, async () => Promise.resolve());

    expect(second.html).toBe(first.html);
    expect(second.changed).toBe(false);
  });
});
