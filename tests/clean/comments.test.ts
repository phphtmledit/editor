import { describe, expect, it } from 'vitest';
import { applyCleanRule } from '../../src/clean';

describe('comments cleaning rule', () => {
  it('removes HTML comments at every nesting level', () => {
    const input = '<!--before--><p>A<!--inside--><strong>B</strong></p><!--after-->';
    const expected = '<p>A<strong>B</strong></p>';

    expect(applyCleanRule(input, 'comments').html).toBe(expected);
  });
});
