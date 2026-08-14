/*! @license GPL-2.0-or-later | https://github.com/phphtmledit/editor */
import { defaultKeymap, history, historyKeymap } from '@codemirror/commands';
import { defaultHighlightStyle, syntaxHighlighting } from '@codemirror/language';
import { searchKeymap } from '@codemirror/search';
import { Annotation, Compartment, EditorState, Transaction, type Extension } from '@codemirror/state';
import { EditorView, keymap, lineNumbers, type ViewUpdate } from '@codemirror/view';
import { plainHtmlLanguage } from './source-language';

type Listener = () => void;
const syncAnnotation = Annotation.define<boolean>();

export interface SourceEditorController {
  getHtml: () => string;
  setHtml: (html: string) => void;
  setHtmlAndResetHistory: (html: string) => void;
  hasFocus: () => boolean;
  setLineWrapping: (enabled: boolean) => void;
  requestMeasure: () => void;
  onChange: (listener: Listener) => () => void;
  onFocus: (listener: Listener) => () => void;
  onBlur: (listener: Listener) => () => void;
  destroy: () => void;
}

const subscribe = (listeners: Set<Listener>, listener: Listener): (() => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

const minimalReplacement = (
  current: string,
  next: string,
): { from: number; to: number; insert: string } | null => {
  if (current === next) return null;
  let prefix = 0;
  const maxPrefix = Math.min(current.length, next.length);
  while (prefix < maxPrefix && current.charCodeAt(prefix) === next.charCodeAt(prefix)) prefix += 1;

  let suffix = 0;
  const maxSuffix = Math.min(current.length - prefix, next.length - prefix);
  while (
    suffix < maxSuffix &&
    current.charCodeAt(current.length - suffix - 1) === next.charCodeAt(next.length - suffix - 1)
  ) suffix += 1;

  return {
    from: prefix,
    to: current.length - suffix,
    insert: next.slice(prefix, next.length - suffix),
  };
};

export const createSourceEditor = (
  parent: HTMLElement,
  characterCount: HTMLOutputElement,
  initialHtml: string,
): SourceEditorController => {
  const wrapping = new Compartment();
  const richFeatures = new Compartment();
  const changeListeners = new Set<Listener>();
  const focusListeners = new Set<Listener>();
  const blurListeners = new Set<Listener>();
  let destroyed = false;
  let richFeaturesRequested = false;
  let lineWrappingEnabled = true;
  let richFeatureExtensions: Extension = [];

  const emit = (listeners: Set<Listener>): void => {
    if (!destroyed) listeners.forEach((listener) => listener());
  };
  const updateCount = (value: string): void => {
    const count = Array.from(value).length;
    characterCount.value = `${count.toLocaleString('ru-RU')} ${count % 10 === 1 && count % 100 !== 11 ? 'знак' : 'знаков'}`;
  };

  let view: EditorView;
  const loadRichFeatures = (): void => {
    if (richFeaturesRequested || destroyed) return;
    richFeaturesRequested = true;
    void import('./source-rich').then(({ sourceRichExtensions }) => {
      richFeatureExtensions = sourceRichExtensions;
      if (!destroyed) view.dispatch({ effects: richFeatures.reconfigure(richFeatureExtensions) });
    }).catch((error: unknown) => {
      richFeaturesRequested = false;
      console.error('CodeMirror HTML tools failed to load', error);
    });
  };
  const updateListener = EditorView.updateListener.of((update: ViewUpdate) => {
    if (update.docChanged) {
      updateCount(update.state.doc.toString());
      if (!update.transactions.some((transaction) => transaction.annotation(syncAnnotation))) {
        emit(changeListeners);
      }
    }
  });

  const baseExtensions: Extension[] = [
    lineNumbers(),
    history(),
    plainHtmlLanguage,
    syntaxHighlighting(defaultHighlightStyle, { fallback: true }),
    keymap.of([...defaultKeymap, ...searchKeymap, ...historyKeymap]),
    updateListener,
    EditorView.contentAttributes.of({
      'aria-label': 'Исходный HTML',
      spellcheck: 'false',
      autocapitalize: 'off',
    }),
    EditorView.theme({
      '&': { height: '100%' },
      '.cm-scroller': { overflow: 'auto', fontFamily: 'var(--phe-mono)' },
      '.cm-content': { minHeight: '100%' },
    }),
  ];
  const createExtensions = (): Extension[] => [
    ...baseExtensions,
    wrapping.of(lineWrappingEnabled ? EditorView.lineWrapping : []),
    richFeatures.of(richFeatureExtensions),
  ];

  view = new EditorView({
    parent,
    state: EditorState.create({ doc: initialHtml, extensions: createExtensions() }),
  });
  updateCount(initialHtml);

  let panelFocused = view.dom.contains(document.activeElement);
  const handleFocusIn = (): void => {
    loadRichFeatures();
    if (panelFocused) return;
    panelFocused = true;
    emit(focusListeners);
  };
  const handleFocusOut = (): void => {
    queueMicrotask(() => {
      const nowFocused = view.dom.contains(document.activeElement);
      if (!panelFocused || nowFocused) return;
      panelFocused = false;
      emit(blurListeners);
    });
  };
  view.dom.addEventListener('focusin', handleFocusIn);
  view.dom.addEventListener('focusout', handleFocusOut);

  return {
    getHtml: () => view.state.doc.toString(),
    setHtml: (nextHtml) => {
      const change = minimalReplacement(view.state.doc.toString(), nextHtml);
      if (!change) return;
      const scrollTop = view.scrollDOM.scrollTop;
      const scrollLeft = view.scrollDOM.scrollLeft;
      view.dispatch({
        changes: change,
        annotations: [syncAnnotation.of(true), Transaction.addToHistory.of(false)],
        scrollIntoView: false,
      });
      queueMicrotask(() => {
        view.scrollDOM.scrollTo(scrollLeft, scrollTop);
      });
    },
    setHtmlAndResetHistory: (nextHtml) => {
      view.setState(EditorState.create({ doc: nextHtml, extensions: createExtensions() }));
      updateCount(nextHtml);
    },
    hasFocus: () => view.dom.contains(document.activeElement),
    setLineWrapping: (enabled) => {
      lineWrappingEnabled = enabled;
      view.dispatch({ effects: wrapping.reconfigure(enabled ? EditorView.lineWrapping : []) });
    },
    requestMeasure: () => view.requestMeasure(),
    onChange: (listener) => subscribe(changeListeners, listener),
    onFocus: (listener) => subscribe(focusListeners, listener),
    onBlur: (listener) => subscribe(blurListeners, listener),
    destroy: () => {
      if (destroyed) return;
      destroyed = true;
      changeListeners.clear();
      focusListeners.clear();
      blurListeners.clear();
      view.dom.removeEventListener('focusin', handleFocusIn);
      view.dom.removeEventListener('focusout', handleFocusOut);
      view.destroy();
    },
  };
};
