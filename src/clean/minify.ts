/*! @license GPL-2.0-or-later | https://github.com/phphtmledit/editor */

import { createDetachedRoot, PREFORMATTED_ELEMENTS, walkTextNodes } from './dom';
import { BLOCK_ELEMENTS } from './format';

function isBlockNode(node: Node | null): boolean {
  return node?.nodeType === 1 && BLOCK_ELEMENTS.has((node as Element).localName.toLowerCase());
}

function isBoundaryWhitespace(textNode: Text): boolean {
  if (!/^[\t\n\f\r ]*$/.test(textNode.data)) {
    return false;
  }

  const previous = textNode.previousSibling;
  const next = textNode.nextSibling;
  return previous === null || next === null || isBlockNode(previous) || isBlockNode(next);
}

export function minifyHtml(html: string): string {
  const root = createDetachedRoot(html);
  walkTextNodes(
    root,
    (textNode) => {
      if (!/[\r\n]/.test(textNode.data)) {
        return;
      }
      textNode.data = textNode.data.replace(/[\t ]*[\r\n]+[\t ]*/g, ' ');
      if (isBoundaryWhitespace(textNode)) {
        textNode.remove();
      }
    },
    PREFORMATTED_ELEMENTS,
  );
  return root.innerHTML;
}
