/*! @license GPL-2.0-or-later | https://github.com/phphtmledit/editor */
import {
  bracketMatchingHandle,
  foldNodeProp,
  LRLanguage,
} from '@codemirror/language';
import { parser as htmlParser } from '@lezer/html';

export const plainHtmlLanguage = LRLanguage.define({
  name: 'html',
  parser: htmlParser.configure({
    props: [
      foldNodeProp.add({
        Element: (node) => {
          const first = node.firstChild;
          const last = node.lastChild;
          if (!first || !last || first.name !== 'OpenTag') return null;
          return { from: first.to, to: last.name === 'CloseTag' ? last.from : node.to };
        },
      }),
      bracketMatchingHandle.add({
        'OpenTag CloseTag': (node) => node.getChild('TagName'),
      }),
    ],
  }),
  languageData: {
    commentTokens: { block: { open: '<!--', close: '-->' } },
    indentOnInput: /^\s*<\/\w+\W$/,
    wordChars: '-_',
  },
});
