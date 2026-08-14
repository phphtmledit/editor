/*! @license GPL-2.0-or-later | https://github.com/phphtmledit/editor */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createProgrammaticMutationGuard } from '../../src/editor/mutation-guard';
import { createSyncController } from '../../src/editor/sync';
import type { SourceEditorController } from '../../src/editor/source';
import type { VisualEditorController } from '../../src/editor/visual';

type Listener = () => void;

const subscribe = (listeners: Set<Listener>, listener: Listener): (() => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

const restoredEditors = (raw: string, normalized: string) => {
  let sourceHtml = raw;
  let visualHtml = normalized;
  let sourceFocused = false;
  let visualFocused = false;
  const sourceChanges = new Set<Listener>();
  const sourceFocuses = new Set<Listener>();
  const sourceBlurs = new Set<Listener>();
  const visualChanges = new Set<Listener>();
  const visualFocuses = new Set<Listener>();
  const visualBlurs = new Set<Listener>();
  const setSourceHtml = vi.fn((html: string) => {
    sourceHtml = html;
    sourceChanges.forEach((listener) => listener());
  });

  const source: SourceEditorController = {
    getHtml: () => sourceHtml,
    setHtml: setSourceHtml,
    setHtmlAndResetHistory: (html) => {
      sourceHtml = html;
    },
    hasFocus: () => sourceFocused,
    setLineWrapping: () => undefined,
    requestMeasure: () => undefined,
    onChange: (listener) => subscribe(sourceChanges, listener),
    onFocus: (listener) => subscribe(sourceFocuses, listener),
    onBlur: (listener) => subscribe(sourceBlurs, listener),
    destroy: () => undefined,
  };
  const visual: VisualEditorController = {
    getHtml: () => visualHtml,
    getText: () => visualHtml.replace(/<[^>]+>/g, ''),
    setHtml: (html) => {
      visualHtml = html.replace(/>\s+</g, '><');
      visualChanges.forEach((listener) => listener());
      return visualHtml;
    },
    setHtmlAndResetHistory: (html) => {
      visualHtml = html;
      return html;
    },
    hasFocus: () => visualFocused,
    onChange: (listener) => subscribe(visualChanges, listener),
    onFocus: (listener) => subscribe(visualFocuses, listener),
    onBlur: (listener) => subscribe(visualBlurs, listener),
    onFileDrop: () => () => undefined,
    destroy: () => undefined,
  };

  return {
    source,
    visual,
    setSourceHtml,
    focusSource: () => {
      visualFocused = false;
      sourceFocused = true;
      sourceFocuses.forEach((listener) => listener());
    },
    focusVisual: () => {
      sourceFocused = false;
      sourceBlurs.forEach((listener) => listener());
      visualFocused = true;
      visualFocuses.forEach((listener) => listener());
    },
  };
};

beforeEach(() => {
  localStorage.clear();
});

describe('restored draft projection', () => {
  it('keeps raw source byte-exact until focus transfers to the normalized visual projection', () => {
    const raw = '<p>first</p>\n\n  <p>second</p>';
    const normalized = '<p>first</p><p>second</p>';
    const editors = restoredEditors(raw, normalized);
    const notice = vi.fn();
    const sync = createSyncController(
      editors.visual,
      editors.source,
      notice,
      createProgrammaticMutationGuard(),
      { raw, normalized, userAuthored: true },
    );

    editors.focusSource();
    expect(editors.source.getHtml()).toBe(raw);
    expect(editors.setSourceHtml).not.toHaveBeenCalled();
    expect(notice).not.toHaveBeenCalled();

    editors.focusVisual();
    expect(editors.source.getHtml()).toBe(normalized);
    expect(editors.setSourceHtml).toHaveBeenCalledOnce();
    expect(notice).toHaveBeenCalledOnce();
    sync.destroy();
  });

  it('does not trust an initial projection that does not match both editors', () => {
    const editors = restoredEditors('<p>raw</p>', '<p>actual</p>');
    const notice = vi.fn();
    const sync = createSyncController(
      editors.visual,
      editors.source,
      notice,
      createProgrammaticMutationGuard(),
      { raw: '<p>raw</p>', normalized: '<p>stale</p>', userAuthored: true },
    );

    editors.focusVisual();
    expect(editors.source.getHtml()).toBe('<p>raw</p>');
    expect(notice).not.toHaveBeenCalled();
    sync.destroy();
  });
});
