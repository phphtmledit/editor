/*! @license GPL-2.0-or-later | https://github.com/phphtmledit/editor */

import { allElements, hasMeaningfulNonTextContent, VOID_ELEMENTS } from '../dom';
import { BLOCK_ELEMENTS } from '../format';
import type { CleanRule } from '../types';

const STRUCTURAL_ELEMENTS = new Set([
  ...VOID_ELEMENTS,
  'audio', 'canvas', 'colgroup', 'iframe', 'math', 'object', 'svg', 'table',
  'tbody', 'td', 'tfoot', 'th', 'thead', 'tr', 'video',
]);

function isSingleNonBreakingSpace(element: Element): boolean {
  if (hasMeaningfulNonTextContent(element)) {
    return false;
  }
  const withoutAsciiWhitespace = (element.textContent ?? '').replace(/[\t\n\f\r ]/g, '');
  return withoutAsciiWhitespace === '\u00a0';
}

export const singleSpaceElementsRule: CleanRule = {
  id: 'single-space-elements',
  label: 'Single-space elements',
  enabledByDefault: true,
  apply(root) {
    for (const element of allElements(root)) {
      const name = element.localName.toLowerCase();
      if (
        element.parentNode === null ||
        !BLOCK_ELEMENTS.has(name) ||
        STRUCTURAL_ELEMENTS.has(name)
      ) {
        continue;
      }
      if (isSingleNonBreakingSpace(element)) {
        element.remove();
      }
    }
  },
};
