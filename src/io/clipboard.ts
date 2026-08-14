/*! @license GPL-2.0-or-later | https://github.com/phphtmledit/editor */

export type ClipboardCopyResult =
  | { readonly ok: true; readonly method: 'clipboard-api' | 'exec-command' }
  | { readonly ok: false; readonly method: null };

const focusWithoutScrolling = (element: HTMLElement): void => {
  try {
    element.focus({ preventScroll: true });
  } catch {
    element.focus();
  }
};

const copyStringToClipboard = async (text: string): Promise<ClipboardCopyResult> => {
  const priorFocus = document.activeElement instanceof HTMLElement
    ? document.activeElement
    : null;
  const priorScrollX = window.scrollX;
  const priorScrollY = window.scrollY;
  let temporaryTextArea: HTMLTextAreaElement | null = null;

  try {
    let clipboardWrite: Promise<void> | undefined;
    try {
      const clipboard = navigator.clipboard;
      if (clipboard && typeof clipboard.writeText === 'function') {
        // Keep this invocation before the first await so the browser's
        // transient user activation is still available inside an iframe.
        clipboardWrite = clipboard.writeText(text);
      }
    } catch {
      clipboardWrite = undefined;
    }

    if (clipboardWrite) {
      try {
        await clipboardWrite;
        return { ok: true, method: 'clipboard-api' };
      } catch {
        // Permission may be absent on the embedding iframe; try the legacy
        // path and only report success if the browser confirms it.
      }
    }

    if (!document.body || typeof document.execCommand !== 'function') {
      return { ok: false, method: null };
    }

    temporaryTextArea = document.createElement('textarea');
    temporaryTextArea.value = text;
    temporaryTextArea.readOnly = true;
    temporaryTextArea.tabIndex = -1;
    temporaryTextArea.style.position = 'fixed';
    temporaryTextArea.style.left = '0';
    temporaryTextArea.style.top = '0';
    temporaryTextArea.style.opacity = '0';
    temporaryTextArea.style.pointerEvents = 'none';
    document.body.append(temporaryTextArea);
    focusWithoutScrolling(temporaryTextArea);
    temporaryTextArea.select();
    temporaryTextArea.setSelectionRange(0, text.length);

    try {
      return document.execCommand('copy')
        ? { ok: true, method: 'exec-command' }
        : { ok: false, method: null };
    } catch {
      return { ok: false, method: null };
    }
  } finally {
    temporaryTextArea?.remove();
    try {
      if (priorFocus?.isConnected) focusWithoutScrolling(priorFocus);
    } finally {
      try {
        window.scrollTo(priorScrollX, priorScrollY);
      } catch {
        // Focus restoration remains best-effort in restricted embedded pages.
      }
    }
  }
};

/** Copies the supplied markup string; it is not converted to rendered text. */
export const copyHtmlToClipboard = (html: string): Promise<ClipboardCopyResult> =>
  copyStringToClipboard(html);

/** Copies caller-provided plain text without deriving it from HTML here. */
export const copyTextToClipboard = (text: string): Promise<ClipboardCopyResult> =>
  copyStringToClipboard(text);
