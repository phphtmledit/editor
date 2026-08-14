/*! @license GPL-2.0-or-later | https://github.com/phphtmledit/editor */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { copyHtmlToClipboard, copyTextToClipboard } from '../../src/io';

let originalClipboard: PropertyDescriptor | undefined;
let originalExecCommand: PropertyDescriptor | undefined;

const setClipboard = (writeText: (text: string) => Promise<void>): void => {
  Object.defineProperty(navigator, 'clipboard', {
    configurable: true,
    value: { writeText },
  });
};

const setExecCommand = (copy: () => boolean): void => {
  Object.defineProperty(document, 'execCommand', {
    configurable: true,
    value: vi.fn((command: string) => command === 'copy' && copy()),
  });
};

describe('clipboard export', () => {
  beforeEach(() => {
    originalClipboard = Object.getOwnPropertyDescriptor(navigator, 'clipboard');
    originalExecCommand = Object.getOwnPropertyDescriptor(document, 'execCommand');
    vi.spyOn(window, 'scrollTo').mockImplementation(() => undefined);
  });

  afterEach(() => {
    if (originalClipboard) {
      Object.defineProperty(navigator, 'clipboard', originalClipboard);
    } else {
      Reflect.deleteProperty(navigator, 'clipboard');
    }
    if (originalExecCommand) {
      Object.defineProperty(document, 'execCommand', originalExecCommand);
    } else {
      Reflect.deleteProperty(document, 'execCommand');
    }
    document.querySelectorAll('textarea').forEach((element) => element.remove());
    vi.restoreAllMocks();
  });

  it('invokes Clipboard.writeText synchronously with the markup string', async () => {
    let finishWrite: (() => void) | undefined;
    const writeText = vi.fn(() => new Promise<void>((resolve) => { finishWrite = resolve; }));
    const execCommand = vi.fn(() => true);
    setClipboard(writeText);
    setExecCommand(execCommand);

    const pending = copyHtmlToClipboard('<strong>Markup</strong>');

    expect(writeText).toHaveBeenCalledWith('<strong>Markup</strong>');
    expect(execCommand).not.toHaveBeenCalled();
    finishWrite?.();
    await expect(pending).resolves.toEqual({ ok: true, method: 'clipboard-api' });
  });

  it('uses the textarea fallback and restores focus, scroll, and DOM', async () => {
    const button = document.createElement('button');
    document.body.append(button);
    button.focus();
    const restoreFocus = vi.spyOn(button, 'focus');
    setClipboard(vi.fn(async () => { throw new DOMException('Denied', 'NotAllowedError'); }));
    setExecCommand(() => true);

    const result = await copyTextToClipboard('Already rendered text');

    expect(result).toEqual({ ok: true, method: 'exec-command' });
    expect(document.execCommand).toHaveBeenCalledWith('copy');
    expect(restoreFocus).toHaveBeenCalled();
    expect(window.scrollTo).toHaveBeenCalledWith(0, 0);
    expect(document.querySelector('textarea')).toBeNull();
    button.remove();
  });

  it('reports failure when both clipboard paths fail and still cleans up', async () => {
    setClipboard(vi.fn(async () => { throw new Error('denied'); }));
    setExecCommand(() => false);

    await expect(copyHtmlToClipboard('<em>Not copied</em>'))
      .resolves.toEqual({ ok: false, method: null });
    expect(document.querySelector('textarea')).toBeNull();
  });

  it('falls back when Clipboard.writeText throws synchronously', async () => {
    setClipboard(vi.fn(() => { throw new TypeError('unavailable'); }));
    setExecCommand(() => true);

    await expect(copyTextToClipboard('Plain text'))
      .resolves.toEqual({ ok: true, method: 'exec-command' });
  });
});
