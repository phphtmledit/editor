/*! @license GPL-2.0-or-later | https://github.com/phphtmledit/editor */

import { allElements } from '../dom';
import type { CleanRule } from '../types';

const NO_ATTRIBUTES = new Set<string>();
const LINK_ATTRIBUTES = new Set(['href']);
const IMAGE_ATTRIBUTES = new Set(['alt', 'src']);

function allowedAttributes(element: Element): ReadonlySet<string> {
  const name = element.localName.toLowerCase();
  if (name === 'a') {
    return LINK_ATTRIBUTES;
  }
  if (name === 'img') {
    return IMAGE_ATTRIBUTES;
  }
  return NO_ATTRIBUTES;
}

export const tagAttributesRule: CleanRule = {
  id: 'tag-attributes',
  label: 'Tag attributes',
  enabledByDefault: false,
  apply(root) {
    for (const element of allElements(root)) {
      const allowed = allowedAttributes(element);
      for (const attribute of Array.from(element.attributes)) {
        if (!allowed.has(attribute.name.toLowerCase())) {
          element.removeAttribute(attribute.name);
        }
      }
    }
  },
};
