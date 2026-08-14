import { describe, expect, it } from 'vitest';
import { applyCleanRule } from '../../src/clean';

describe('inline-styles cleaning rule', () => {
  it('removes inline and legacy presentational attributes', () => {
    const input = '<p style="color:red" align="center" data-note="keep">Text</p><img width="20" height="10" src="x">';
    const expected = '<p data-note="keep">Text</p><img src="x">';

    expect(applyCleanRule(input, 'inline-styles').html).toBe(expected);
  });
});
