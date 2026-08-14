/*! @license GPL-2.0-or-later | https://github.com/phphtmledit/editor */

import { allElements } from '../dom';
import type { CleanRule } from '../types';

const PRESENTATIONAL_ATTRIBUTES = new Set([
  'align', 'background', 'bgcolor', 'border', 'bordercolor', 'cellpadding',
  'cellspacing', 'clear', 'color', 'compact', 'face', 'frame', 'height',
  'hspace', 'noshade', 'nowrap', 'rules', 'size', 'style', 'text', 'valign',
  'vspace', 'width',
]);

export const inlineStylesRule: CleanRule = {
  id: 'inline-styles',
  label: 'Inline styles',
  enabledByDefault: true,
  apply(root) {
    for (const element of allElements(root)) {
      for (const attribute of Array.from(element.attributes)) {
        if (PRESENTATIONAL_ATTRIBUTES.has(attribute.name.toLowerCase())) {
          element.removeAttribute(attribute.name);
        }
      }
    }
  },
};
