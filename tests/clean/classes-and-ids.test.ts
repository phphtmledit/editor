import { describe, expect, it } from 'vitest';
import { applyCleanRule } from '../../src/clean';

describe('classes-and-ids cleaning rule', () => {
  it('removes class and id without touching unrelated attributes', () => {
    const input = '<div id="hero" class="one two" data-state="ready"><p class="copy">Text</p></div>';
    const expected = '<div data-state="ready"><p>Text</p></div>';

    expect(applyCleanRule(input, 'classes-and-ids').html).toBe(expected);
  });
});
