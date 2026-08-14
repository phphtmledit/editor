import { describe, expect, it } from 'vitest';
import { applyCleanRule } from '../../src/clean';

describe('plain-text cleaning rule', () => {
  it('removes markup while keeping text safely escaped as HTML', () => {
    const input = '<p>Fish &amp; <strong>chips</strong> &lt;3</p><p>Second<br><br>line</p>';
    const expected = 'Fish &amp; chips &lt;3\nSecond\n\nline';

    expect(applyCleanRule(input, 'plain-text').html).toBe(expected);
  });
});
