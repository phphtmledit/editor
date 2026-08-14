/*! @license GPL-2.0-or-later | https://github.com/phphtmledit/editor */

import type { CleanRule } from '../types';

const COMMENT_NODE = 8;

function removeComments(node: Node): void {
  for (const child of Array.from(node.childNodes)) {
    if (child.nodeType === COMMENT_NODE) {
      child.remove();
    } else {
      removeComments(child);
    }
  }
}

export const commentsRule: CleanRule = {
  id: 'comments',
  label: 'HTML comments',
  enabledByDefault: true,
  apply(root) {
    removeComments(root);
  },
};
