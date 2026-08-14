/*! @license GPL-2.0-or-later | https://github.com/phphtmledit/editor */
import type { Bookmark, Editor, TinyMCE } from 'tinymce';

const PLUGINS = [
  'lists',
  'link',
  'image',
  'table',
  'charmap',
  'emoticons',
  'insertdatetime',
] as const;

type Listener = () => void;

interface TextSelectionSnapshot {
  start: number;
  end: number;
  text: string;
}

export interface VisualEditorController {
  getHtml: () => string;
  setHtml: (html: string) => string;
  hasFocus: () => boolean;
  onChange: (listener: Listener) => () => void;
  onFocus: (listener: Listener) => () => void;
  onBlur: (listener: Listener) => () => void;
  destroy: () => void;
}

declare global {
  interface Window {
    tinymce: TinyMCE;
  }
}

const subscribe = (listeners: Set<Listener>, listener: Listener): (() => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

const textOffset = (body: HTMLElement, node: Node, offset: number): number => {
  const range = body.ownerDocument.createRange();
  range.selectNodeContents(body);
  range.setEnd(node, offset);
  return range.toString().length;
};

const snapshotTextSelection = (editor: Editor): TextSelectionSnapshot | null => {
  const body = editor.getBody();
  const range = editor.selection.getRng();
  if (!body.contains(range.startContainer) || !body.contains(range.endContainer)) return null;
  return {
    start: textOffset(body, range.startContainer, range.startOffset),
    end: textOffset(body, range.endContainer, range.endOffset),
    text: body.textContent ?? '',
  };
};

const mapTextOffset = (oldText: string, nextText: string, offset: number): number => {
  let prefix = 0;
  const maxPrefix = Math.min(oldText.length, nextText.length);
  while (prefix < maxPrefix && oldText.charCodeAt(prefix) === nextText.charCodeAt(prefix)) prefix += 1;

  let suffix = 0;
  const maxSuffix = Math.min(oldText.length - prefix, nextText.length - prefix);
  while (
    suffix < maxSuffix &&
    oldText.charCodeAt(oldText.length - suffix - 1) === nextText.charCodeAt(nextText.length - suffix - 1)
  ) suffix += 1;

  if (offset <= prefix) return offset;
  if (offset >= oldText.length - suffix) return nextText.length - (oldText.length - offset);
  return Math.min(nextText.length - suffix, prefix + Math.min(offset - prefix, nextText.length - prefix - suffix));
};

const textPoint = (body: HTMLElement, offset: number): { node: Node; offset: number } => {
  const target = Math.max(0, Math.min(offset, (body.textContent ?? '').length));
  const walker = body.ownerDocument.createTreeWalker(body, NodeFilter.SHOW_TEXT);
  let consumed = 0;
  let lastText: Text | null = null;
  for (let current = walker.nextNode(); current; current = walker.nextNode()) {
    const text = current as Text;
    const length = text.data.length;
    if (target <= consumed + length) return { node: text, offset: target - consumed };
    consumed += length;
    lastText = text;
  }
  return lastText ? { node: lastText, offset: lastText.data.length } : { node: body, offset: 0 };
};

const restoreTextSelection = (
  editor: Editor,
  snapshot: TextSelectionSnapshot,
): { start: number; end: number } => {
  const body = editor.getBody();
  const nextText = body.textContent ?? '';
  const start = mapTextOffset(snapshot.text, nextText, snapshot.start);
  const end = mapTextOffset(snapshot.text, nextText, snapshot.end);
  const startPoint = textPoint(body, Math.min(start, end));
  const endPoint = textPoint(body, Math.max(start, end));
  const range = body.ownerDocument.createRange();
  range.setStart(startPoint.node, startPoint.offset);
  range.setEnd(endPoint.node, endPoint.offset);
  editor.selection.setRng(range, true);
  return { start: Math.min(start, end), end: Math.max(start, end) };
};

export const createVisualEditor = async (
  panel: HTMLElement,
): Promise<VisualEditorController> => {
  const tiny = window.tinymce;
  if (!tiny) throw new Error('TinyMCE runtime is unavailable');

  if (!tiny.IconManager.has('default')) tiny.IconManager.add('default', { icons: {} });

  const editors: Editor[] = await tiny.init({
    selector: '#visual-editor',
    base_url: '/tinymce',
    suffix: '.min',
    license_key: 'gpl',
    theme: 'silver',
    model: 'dom',
    icons: 'phphtmledit',
    icons_url: '/tinymce/icons/phphtmledit/icons.min.js',
    cache_suffix: '?v=8.8.2',
    language: 'en',
    skin: 'oxide',
    content_css: 'default',
    plugins: [...PLUGINS],
    menubar: 'file edit view insert format table',
    toolbar:
      'undo redo | blocks | bold italic underline strikethrough | forecolor backcolor | ' +
      'alignleft aligncenter alignright alignjustify | bullist numlist outdent indent | ' +
      'link image hr table | charmap emoticons insertdatetime | removeformat',
    block_formats:
      'Paragraph=p; Heading 1=h1; Heading 2=h2; Heading 3=h3; Heading 4=h4; ' +
      'Quote=blockquote; Preformatted=pre',
    promotion: false,
    branding: false,
    xss_sanitization: true,
    automatic_uploads: false,
    resize: false,
    height: '100%',
  });

  const editor = editors[0];
  if (!editor) throw new Error('TinyMCE did not return an editor instance');

  const changeListeners = new Set<Listener>();
  const focusListeners = new Set<Listener>();
  const blurListeners = new Set<Listener>();
  let destroyed = false;
  let applyingContent = false;
  let lastBookmark: Bookmark | null = null;
  let lastTextSelection: TextSelectionSnapshot | null = null;

  const emit = (listeners: Set<Listener>): void => {
    if (!destroyed) listeners.forEach((listener) => listener());
  };

  const isVisualTarget = (target: EventTarget | null): boolean => {
    if (!(target instanceof Element)) return false;
    return panel.contains(target) || tiny.FocusManager.isEditorUIElement(target);
  };

  const hasFocus = (): boolean => {
    const active = document.activeElement;
    return editor.hasFocus() || isVisualTarget(active);
  };

  const rememberSelection = (): void => {
    if (destroyed || applyingContent) return;
    try {
      lastBookmark = editor.selection.getBookmark(2, true);
      lastTextSelection = snapshotTextSelection(editor);
    } catch {
      // Keep the last selection captured while the iframe was active.
    }
  };
  const handleEditorChange = (): void => emit(changeListeners);
  const handleEditorFocus = (): void => {
    rememberSelection();
    emit(focusListeners);
  };
  const handleEditorBlur = (): void => {
    rememberSelection();
    queueMicrotask(() => {
      if (!hasFocus()) emit(blurListeners);
    });
  };
  const handleDocumentFocus = (event: FocusEvent): void => {
    if (isVisualTarget(event.target)) emit(focusListeners);
    else if (!editor.hasFocus()) emit(blurListeners);
  };
  const handleDocumentPointer = (event: PointerEvent): void => {
    if (isVisualTarget(event.target)) emit(focusListeners);
  };

  editor.on('input change undo redo', handleEditorChange);
  editor.on('focus', handleEditorFocus);
  editor.on('blur', handleEditorBlur);
  editor.on('SelectionChange NodeChange', rememberSelection);
  document.addEventListener('focusin', handleDocumentFocus, true);
  document.addEventListener('pointerdown', handleDocumentPointer, true);
  rememberSelection();

  const setHtml = (html: string): string => {
    if (html === editor.getContent({ format: 'html' })) return html;

    const bookmark = lastBookmark;
    const textSelection = lastTextSelection;

    const editorWindow = editor.getWin();
    const scroll = { x: editorWindow.scrollX, y: editorWindow.scrollY };

    applyingContent = true;
    try {
      editor.undoManager.ignore(() => {
        editor.setContent(html, { format: 'html', no_selection: true });
      });
    } finally {
      applyingContent = false;
    }

    let bookmarkMatches = false;
    if (bookmark) {
      try {
        editor.selection.moveToBookmark(bookmark);
        if (textSelection) {
          const restored = snapshotTextSelection(editor);
          const nextText = editor.getBody().textContent ?? '';
          bookmarkMatches = restored !== null &&
            restored.start === mapTextOffset(textSelection.text, nextText, textSelection.start) &&
            restored.end === mapTextOffset(textSelection.text, nextText, textSelection.end);
        } else {
          bookmarkMatches = true;
        }
      } catch {
        // The normalized DOM may no longer contain the bookmarked nodes.
      }
    }
    if (textSelection && !bookmarkMatches) restoreTextSelection(editor, textSelection);
    rememberSelection();
    editorWindow.scrollTo(scroll.x, scroll.y);
    return editor.getContent({ format: 'html' });
  };

  return {
    getHtml: () => editor.getContent({ format: 'html' }),
    setHtml,
    hasFocus,
    onChange: (listener) => subscribe(changeListeners, listener),
    onFocus: (listener) => subscribe(focusListeners, listener),
    onBlur: (listener) => subscribe(blurListeners, listener),
    destroy: () => {
      if (destroyed) return;
      destroyed = true;
      document.removeEventListener('focusin', handleDocumentFocus, true);
      document.removeEventListener('pointerdown', handleDocumentPointer, true);
      editor.off('input change undo redo', handleEditorChange);
      editor.off('focus', handleEditorFocus);
      editor.off('blur', handleEditorBlur);
      editor.off('SelectionChange NodeChange', rememberSelection);
      changeListeners.clear();
      focusListeners.clear();
      blurListeners.clear();
      editor.remove();
    },
  };
};
