/*! @license GPL-2.0-or-later | https://github.com/phphtmledit/editor */

import { allElements, VOID_ELEMENTS } from '../dom';
import type { CleanRule } from '../types';

const STRUCTURAL_OR_EMBEDDED_ELEMENTS = new Set([
  ...VOID_ELEMENTS,
  'audio', 'canvas', 'colgroup', 'iframe', 'math', 'object', 'svg', 'table',
  'tbody', 'td', 'tfoot', 'th', 'thead', 'tr', 'video',
]);

function containsMeaningfulContent(element: Element): boolean {
  for (const child of Array.from(element.childNodes)) {
    if (child.nodeType === 1) {
      return true;
    }
    if (child.nodeType === 3 && /[^\t\n\f\r ]/.test(child.textContent ?? '')) {
      return true;
    }
    if (child.nodeType !== 3 && child.nodeType !== 8) {
      return true;
    }
  }
  return false;
}

export const emptyElementsRule: CleanRule = {
  id: 'empty-elements',
  label: 'Empty elements',
  enabledByDefault: true,
  apply(root) {
    const elements = allElements(root);
    for (let index = elements.length - 1; index >= 0; index -= 1) {
      const element = elements[index];
      if (element === undefined || element.parentNode === null) {
        continue;
      }
      if (STRUCTURAL_OR_EMBEDDED_ELEMENTS.has(element.localName.toLowerCase())) {
        continue;
      }
      if (!containsMeaningfulContent(element)) {
        element.remove();
      }
    }
  },
};
