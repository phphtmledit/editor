/*! @license GPL-2.0-or-later | https://github.com/phphtmledit/editor */

import type { CleanRule } from '../types';
import { BLOCK_ELEMENTS } from '../format';

function appendLineBreak(parts: string[]): void {
  const lastPart = parts[parts.length - 1];
  if (lastPart !== undefined && lastPart !== '' && !lastPart.endsWith('\n')) {
    parts.push('\n');
  }
}

function collectPlainText(node: Node, parts: string[]): void {
  if (node.nodeType === 3) {
    parts.push(node.textContent ?? '');
    return;
  }
  if (node.nodeType !== 1) {
    return;
  }

  const element = node as Element;
  const name = element.localName.toLowerCase();
  if (name === 'br') {
    parts.push('\n');
    return;
  }

  const isBlock = BLOCK_ELEMENTS.has(name);
  if (isBlock) {
    appendLineBreak(parts);
  }
  for (const child of Array.from(element.childNodes)) {
    collectPlainText(child, parts);
  }
  if (isBlock) {
    appendLineBreak(parts);
  }
}

export const plainTextRule: CleanRule = {
  id: 'plain-text',
  label: 'Text only',
  enabledByDefault: false,
  apply(root) {
    const parts: string[] = [];
    for (const child of Array.from(root.childNodes)) {
      collectPlainText(child, parts);
    }
    root.textContent = parts.join('').replace(/^\n+|\n+$/g, '');
  },
};
