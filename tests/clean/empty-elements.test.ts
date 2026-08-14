import { describe, expect, it } from 'vitest';
import { applyCleanRule } from '../../src/clean';

describe('empty-elements cleaning rule', () => {
  it('removes empty containers but preserves meaningful void and table structure', () => {
    const input = '<div><span> \n </span><p>Text</p><img src="x"><table><tbody><tr><td></td></tr></tbody></table></div>';
    const expected = '<div><p>Text</p><img src="x"><table><tbody><tr><td></td></tr></tbody></table></div>';

    expect(applyCleanRule(input, 'empty-elements').html).toBe(expected);
  });
});
