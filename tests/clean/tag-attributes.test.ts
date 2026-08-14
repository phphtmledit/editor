import { describe, expect, it } from 'vitest';
import { applyCleanRule } from '../../src/clean';

describe('tag-attributes cleaning rule', () => {
  it('keeps only href on links and src plus alt on images', () => {
    const input = '<p lang="en"><a href="/docs" title="Docs" target="_blank">Link</a><img src="x.png" alt="X" width="10" loading="lazy"></p>';
    const expected = '<p><a href="/docs">Link</a><img src="x.png" alt="X"></p>';

    expect(applyCleanRule(input, 'tag-attributes').html).toBe(expected);
  });
});
