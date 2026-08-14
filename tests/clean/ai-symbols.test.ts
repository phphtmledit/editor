import { describe, expect, it } from 'vitest';
import { applyCleanRule } from '../../src/clean';

describe('ai-symbols cleaning rule', () => {
  it('normalizes typographic artifacts without modifying code or preformatted text', () => {
    const input = '<p>«Hello»—\u200b‘world’–narrow\u202fspace</p><pre>“keep”—\u2009</pre>';
    const expected = '<p>"Hello"-\'world\'-narrow space</p><pre>“keep”—\u2009</pre>';

    expect(applyCleanRule(input, 'ai-symbols').html).toBe(expected);
  });
});
