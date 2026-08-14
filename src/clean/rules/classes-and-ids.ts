/*! @license GPL-2.0-or-later | https://github.com/phphtmledit/editor */

import { allElements } from '../dom';
import type { CleanRule } from '../types';

export const classesAndIdsRule: CleanRule = {
  id: 'classes-and-ids',
  label: 'Classes and IDs',
  enabledByDefault: true,
  apply(root) {
    for (const element of allElements(root)) {
      element.removeAttribute('class');
      element.removeAttribute('id');
    }
  },
};
