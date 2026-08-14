/*! @license GPL-2.0-or-later | https://github.com/phphtmledit/editor */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createMassDocumentController } from '../../src/editor/mass-document';
import { createProgrammaticMutationGuard } from '../../src/editor/mutation-guard';
import { createSyncController } from '../../src/editor/sync';
import type { SourceEditorController } from '../../src/editor/source';
import type { VisualEditorController } from '../../src/editor/visual';

type Listener = () => void;

interface FakeEditors {
  visual: VisualEditorController;
  source: SourceEditorController;
  setVisualFocus: (focused: boolean) => void;
  setSourceFocus: (focused: boolean) => void;
  emitVisualChange: () => void;
  normalVisualWrite: ReturnType<typeof vi.fn>;
  normalSourceWrite: ReturnType<typeof vi.fn>;
  massVisualWrite: ReturnType<typeof vi.fn>;
  massSourceWrite: ReturnType<typeof vi.fn>;
}

const subscribe = (listeners: Set<Listener>, listener: Listener): (() => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

const createFakeEditors = (initialHtml: string): FakeEditors => {
  let visualHtml = initialHtml;
  let sourceHtml = initialHtml;
  let visualFocused = false;
  let sourceFocused = false;
  const visualChanges = new Set<Listener>();
  const visualFocuses = new Set<Listener>();
  const visualBlurs = new Set<Listener>();
  const sourceChanges = new Set<Listener>();
  const sourceFocuses = new Set<Listener>();
  const sourceBlurs = new Set<Listener>();
  const normalVisualWrite = vi.fn((html: string) => {
    visualHtml = html;
    visualChanges.forEach((listener) => listener());
    return html;
  });
  const normalSourceWrite = vi.fn((html: string) => {
    sourceHtml = html;
    sourceChanges.forEach((listener) => listener());
  });
  const massVisualWrite = vi.fn((html: string) => {
    visualHtml = html.replace(' data-unsafe="true"', '');
    visualChanges.forEach((listener) => listener());
    return visualHtml;
  });
  const massSourceWrite = vi.fn((html: string) => {
    sourceHtml = html;
    sourceChanges.forEach((listener) => listener());
  });

  const visual: VisualEditorController = {
    getHtml: () => visualHtml,
    setHtml: normalVisualWrite,
    setHtmlAndResetHistory: massVisualWrite,
    hasFocus: () => visualFocused,
    onChange: (listener) => subscribe(visualChanges, listener),
    onFocus: (listener) => subscribe(visualFocuses, listener),
    onBlur: (listener) => subscribe(visualBlurs, listener),
    destroy: () => undefined,
  };
  const source: SourceEditorController = {
    getHtml: () => sourceHtml,
    setHtml: normalSourceWrite,
    setHtmlAndResetHistory: massSourceWrite,
    hasFocus: () => sourceFocused,
    setLineWrapping: () => undefined,
    requestMeasure: () => undefined,
    onChange: (listener) => subscribe(sourceChanges, listener),
    onFocus: (listener) => subscribe(sourceFocuses, listener),
    onBlur: (listener) => subscribe(sourceBlurs, listener),
    destroy: () => undefined,
  };

  return {
    visual,
    source,
    setVisualFocus: (focused) => {
      visualFocused = focused;
      (focused ? visualFocuses : visualBlurs).forEach((listener) => listener());
    },
    setSourceFocus: (focused) => {
      sourceFocused = focused;
      (focused ? sourceFocuses : sourceBlurs).forEach((listener) => listener());
    },
    emitVisualChange: () => visualChanges.forEach((listener) => listener()),
    normalVisualWrite,
    normalSourceWrite,
    massVisualWrite,
    massSourceWrite,
  };
};

afterEach(() => {
  vi.useRealTimers();
});

describe('mass document controller', () => {
  it('uses the explicit snapshot after focus loss and writes Tiny normalization to both panels', () => {
    const editors = createFakeEditors('<p>visual projection</p>');
    editors.source.setHtml('<p>raw source</p>');
    editors.normalSourceWrite.mockClear();
    const guard = createProgrammaticMutationGuard();
    const controller = createMassDocumentController(editors.visual, editors.source, guard);

    const result = controller.apply(
      'Clean document',
      '<p data-unsafe="true">clean</p>',
      '<p>raw source</p>',
    );

    expect(result).toEqual({ html: '<p>clean</p>', label: 'Clean document' });
    expect(editors.visual.getHtml()).toBe('<p>clean</p>');
    expect(editors.source.getHtml()).toBe('<p>clean</p>');
    expect(controller.getUndoState().nextLabel).toBe('Clean document');

    expect(controller.undo()).toEqual({ html: '<p>raw source</p>', label: 'Clean document' });
    expect(editors.visual.getHtml()).toBe('<p>raw source</p>');
    expect(editors.source.getHtml()).toBe('<p>raw source</p>');
  });

  it('undoes clean and replace operations in one chronological stack', () => {
    const editors = createFakeEditors('<p>one</p>');
    const controller = createMassDocumentController(
      editors.visual,
      editors.source,
      createProgrammaticMutationGuard(),
    );

    controller.apply('Clean document', '<p>two</p>', '<p>one</p>');
    controller.apply('Replace all', '<p>three</p>', '<p>two</p>');

    expect(controller.undo()).toEqual({ html: '<p>two</p>', label: 'Replace all' });
    expect(controller.getUndoState().nextLabel).toBe('Clean document');
    expect(controller.undo()).toEqual({ html: '<p>one</p>', label: 'Clean document' });
    expect(controller.getUndoState()).toEqual({ count: 0, totalBytes: 0, nextLabel: null });
    expect(controller.undo()).toBeNull();
  });

  it('publishes state for one shared undo button', () => {
    const editors = createFakeEditors('<p>one</p>');
    const controller = createMassDocumentController(
      editors.visual,
      editors.source,
      createProgrammaticMutationGuard(),
    );
    const listener = vi.fn();
    const unsubscribe = controller.onUndoStateChange(listener);

    controller.apply('Replace one rule', '<p>two</p>', '<p>one</p>');
    controller.undo();
    unsubscribe();
    controller.apply('Clean one rule', '<p>three</p>', '<p>one</p>');

    expect(listener).toHaveBeenNthCalledWith(1, expect.objectContaining({
      count: 1,
      nextLabel: 'Replace one rule',
    }));
    expect(listener).toHaveBeenNthCalledWith(2, { count: 0, totalBytes: 0, nextLabel: null });
    expect(listener).toHaveBeenCalledTimes(2);
  });

  it('cancels pending E1 synchronization and never calls its history-preserving writers', () => {
    vi.useFakeTimers();
    const editors = createFakeEditors('<p>before</p>');
    editors.setVisualFocus(true);
    const guard = createProgrammaticMutationGuard();
    const sync = createSyncController(editors.visual, editors.source, () => undefined, guard);
    const controller = createMassDocumentController(editors.visual, editors.source, guard);

    editors.emitVisualChange();
    controller.apply('Clean document', '<p>after</p>', '<p>before</p>');
    vi.advanceTimersByTime(1_000);

    expect(editors.normalVisualWrite).not.toHaveBeenCalled();
    expect(editors.normalSourceWrite).not.toHaveBeenCalled();
    expect(editors.visual.getHtml()).toBe('<p>after</p>');
    expect(editors.source.getHtml()).toBe('<p>after</p>');
    sync.destroy();
  });

  it('does not reset histories or add undo state for a no-op', () => {
    const editors = createFakeEditors('<p>same</p>');
    const controller = createMassDocumentController(
      editors.visual,
      editors.source,
      createProgrammaticMutationGuard(),
    );

    controller.apply('Replace all', '<p>same</p>', '<p>same</p>');

    expect(controller.getUndoState()).toEqual({ count: 0, totalBytes: 0, nextLabel: null });
    expect(editors.visual.getHtml()).toBe('<p>same</p>');
    expect(editors.source.getHtml()).toBe('<p>same</p>');
    expect(editors.massVisualWrite).not.toHaveBeenCalled();
    expect(editors.massSourceWrite).not.toHaveBeenCalled();
  });

  it('keeps app undo when Tiny normalization returns the original snapshot', () => {
    const editors = createFakeEditors('<p>same</p>');
    const controller = createMassDocumentController(
      editors.visual,
      editors.source,
      createProgrammaticMutationGuard(),
    );

    const result = controller.apply(
      'Replace unsafe insertion',
      '<p data-unsafe="true">same</p>',
      '<p>same</p>',
    );

    expect(result.html).toBe('<p>same</p>');
    expect(editors.massVisualWrite).toHaveBeenCalledOnce();
    expect(editors.massSourceWrite).toHaveBeenCalledOnce();
    expect(controller.getUndoState()).toMatchObject({
      count: 1,
      nextLabel: 'Replace unsafe insertion',
    });
  });

  it('keeps the pre-write snapshot and releases the guard when a mass writer throws', () => {
    const editors = createFakeEditors('<p>before</p>');
    const guard = createProgrammaticMutationGuard();
    const controller = createMassDocumentController(editors.visual, editors.source, guard);
    editors.massVisualWrite.mockImplementationOnce(() => {
      throw new Error('mass write failed');
    });

    expect(() => controller.apply(
      'Clean document',
      '<p>after</p>',
      '<p>before</p>',
    )).toThrow('mass write failed');

    expect(guard.isActive()).toBe(false);
    expect(controller.getUndoState()).toMatchObject({
      count: 1,
      nextLabel: 'Clean document',
    });
  });
});
