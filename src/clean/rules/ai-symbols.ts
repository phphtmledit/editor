/*! @license GPL-2.0-or-later | https://github.com/phphtmledit/editor */

import { PREFORMATTED_ELEMENTS, walkTextNodes } from '../dom';
import type { CleanRule } from '../types';

const CHARACTER_REPLACEMENTS = new Map<string, string>([
  ['\u00ab', '"'],
  ['\u00bb', '"'],
  ['\u2018', "'"],
  ['\u2019', "'"],
  ['\u201a', "'"],
  ['\u201b', "'"],
  ['\u201c', '"'],
  ['\u201d', '"'],
  ['\u201e', '"'],
  ['\u201f', '"'],
  ['\u2039', '"'],
  ['\u203a', '"'],
  ['\u2013', '-'],
  ['\u2014', '-'],
  ['\u2009', ' '],
  ['\u200a', ' '],
  ['\u202f', ' '],
]);

const ZERO_WIDTH_CHARACTERS = /[\u200b\u200c\u200d\u2060\ufeff]/g;
const REPLACEABLE_CHARACTERS = /[\u00ab\u00bb\u2009\u200a\u2013\u2014\u2018-\u201f\u202f\u2039\u203a]/g;

export function normalizeAiSymbols(value: string): string {
  return value
    .replace(ZERO_WIDTH_CHARACTERS, '')
    .replace(REPLACEABLE_CHARACTERS, (character) => CHARACTER_REPLACEMENTS.get(character) ?? character);
}

export const aiSymbolsRule: CleanRule = {
  id: 'ai-symbols',
  label: 'AI symbols',
  enabledByDefault: true,
  apply(root) {
    walkTextNodes(
      root,
      (textNode) => {
        textNode.data = normalizeAiSymbols(textNode.data);
      },
      PREFORMATTED_ELEMENTS,
    );
  },
};
