import { describe, expect, it } from 'vitest';
import { applyCleanRule } from '../../src/clean';

describe('single-space-elements cleaning rule', () => {
  it('removes containers whose only content is one non-breaking space', () => {
    const input = '<p>&nbsp;</p><p> &nbsp; </p><p>keep&nbsp;</p><span>&nbsp;</span><span><br></span>';
    const expected = '<p>keep&nbsp;</p><span>&nbsp;</span><span><br></span>';

    expect(applyCleanRule(input, 'single-space-elements').html).toBe(expected);
  });
});
