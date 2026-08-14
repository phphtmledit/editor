/*! @license GPL-2.0-or-later | https://github.com/phphtmledit/editor */

import { PREFORMATTED_ELEMENTS, VOID_ELEMENTS } from '../dom';
import { BLOCK_ELEMENTS } from '../format';
import type { CleanRule } from '../types';

const ELEMENT_NODE = 1;
const TEXT_NODE = 3;
const COLLAPSIBLE_SPACES = /[ \u00a0]/;

function collapseContinuousText(root: Node): void {
  let pendingSpaceCount = 0;
  let pendingCharacter = '';
  let pendingTextNode: Text | null = null;
  let lastContentTextNode: Text | null = null;

  const pendingReplacement = (): string => pendingSpaceCount === 1 ? pendingCharacter : ' ';

  const flushPendingSpace = (): void => {
    if (pendingSpaceCount > 0) {
      const target = lastContentTextNode ?? pendingTextNode;
      if (target !== null) target.data += pendingReplacement();
    }
    pendingSpaceCount = 0;
    pendingCharacter = '';
    pendingTextNode = null;
  };

  const reset = (): void => {
    flushPendingSpace();
    lastContentTextNode = null;
  };

  const visit = (node: Node): void => {
    if (node.nodeType === TEXT_NODE) {
      const textNode = node as Text;
      let next = '';
      for (const character of textNode.data) {
        if (COLLAPSIBLE_SPACES.test(character)) {
          if (pendingSpaceCount === 0) pendingCharacter = character;
          pendingSpaceCount += 1;
          pendingTextNode = textNode;
        } else {
          if (pendingSpaceCount > 0) next += pendingReplacement();
          next += character;
          pendingSpaceCount = 0;
          pendingCharacter = '';
          pendingTextNode = null;
          lastContentTextNode = textNode;
        }
      }
      textNode.data = next;
      return;
    }
    if (node.nodeType !== ELEMENT_NODE) return;

    const element = node as Element;
    const name = element.localName.toLowerCase();
    const boundary = BLOCK_ELEMENTS.has(name) || VOID_ELEMENTS.has(name);
    if (boundary || PREFORMATTED_ELEMENTS.has(name)) reset();
    if (!PREFORMATTED_ELEMENTS.has(name) && !VOID_ELEMENTS.has(name)) {
      for (const child of Array.from(element.childNodes)) visit(child);
    }
    if (boundary || PREFORMATTED_ELEMENTS.has(name)) reset();
  };

  for (const child of Array.from(root.childNodes)) visit(child);
  reset();
}

export const repeatedSpacesRule: CleanRule = {
  id: 'repeated-spaces',
  label: 'Repeated spaces',
  enabledByDefault: true,
  apply(root) {
    collapseContinuousText(root);
  },
};
