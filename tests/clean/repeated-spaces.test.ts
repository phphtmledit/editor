import { describe, expect, it } from 'vitest';
import { applyCleanRule } from '../../src/clean';

describe('repeated-spaces cleaning rule', () => {
  it('collapses ordinary and non-breaking space runs outside preformatted content', () => {
    const input = '<p>A&nbsp;  B   C; 10&nbsp;kg</p><pre>A   B</pre><code>C  D</code>';
    const expected = '<p>A B C; 10&nbsp;kg</p><pre>A   B</pre><code>C  D</code>';

    expect(applyCleanRule(input, 'repeated-spaces').html).toBe(expected);
  });

  it('collapses one visual run across inline nodes but not across content boundaries', () => {
    const input = '<p><span>A </span><em> B&nbsp;</em><span> C</span><br> D<img src="x"> E</p><div> F</div><pre> G  H</pre>';
    const expected = '<p><span>A</span><em> B</em><span> C</span><br> D<img src="x"> E</p><div> F</div><pre> G  H</pre>';

    expect(applyCleanRule(input, 'repeated-spaces').html).toBe(expected);
  });
});
