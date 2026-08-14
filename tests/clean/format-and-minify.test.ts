import { describe, expect, it } from 'vitest';
import { formatHtml, minifyHtml } from '../../src/clean';

describe('HTML formatting operations', () => {
  it('adds deterministic indentation around nested block elements', () => {
    const input = '<div><p>Hello <strong>world</strong></p><ul><li>One</li><li>Two</li></ul></div>';
    const expected = [
      '<div>',
      '  <p>Hello <strong>world</strong></p>',
      '  <ul>',
      '    <li>One</li>',
      '    <li>Two</li>',
      '  </ul>',
      '</div>',
    ].join('\n');

    expect(formatHtml(input)).toBe(expected);
  });

  it('removes formatting line breaks without changing preformatted content', () => {
    const input = '<div>\n  <p>Hello\n    world</p>\n  <p>Again</p>\n</div><pre>A\n  B</pre>';
    const expected = '<div><p>Hello world</p><p>Again</p></div><pre>A\n  B</pre>';

    expect(minifyHtml(input)).toBe(expected);
  });
});
