/*! @license GPL-2.0-or-later | https://github.com/phphtmledit/editor */
import { autocompletion } from '@codemirror/autocomplete';
import { htmlCompletionSource } from '@codemirror/lang-html';
import {
  bracketMatching,
  foldGutter,
  foldKeymap,
} from '@codemirror/language';
import type { Extension } from '@codemirror/state';
import { keymap } from '@codemirror/view';

export const sourceRichExtensions: Extension = [
  autocompletion({ override: [htmlCompletionSource] }),
  foldGutter(),
  bracketMatching(),
  keymap.of(foldKeymap),
];
