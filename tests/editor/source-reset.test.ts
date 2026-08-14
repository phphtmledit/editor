/*! @license GPL-2.0-or-later | https://github.com/phphtmledit/editor */
import { redoDepth, undoDepth } from '@codemirror/commands';
import { EditorView } from '@codemirror/view';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createSourceEditor } from '../../src/editor/source';

describe('CodeMirror mass document write', () => {
  afterEach(() => {
    document.body.replaceChildren();
  });

  it('resets history while retaining wrapping and already loaded rich-feature compartments', async () => {
    const parent = document.createElement('div');
    const count = document.createElement('output');
    document.body.append(parent, count);
    const controller = createSourceEditor(parent, count, '<p>initial</p>');
    const view = EditorView.findFromDOM(parent);
    if (!view) throw new Error('CodeMirror view was not created');
    view.scrollDOM.scrollTo = vi.fn();

    view.dispatch({
      changes: { from: 3, to: 10, insert: 'edited' },
    });
    expect(undoDepth(view.state)).toBeGreaterThan(0);
    const localHistoryDepth = undoDepth(view.state);
    controller.setHtml('<p>history-preserving sync</p>');
    expect(undoDepth(view.state)).toBe(localHistoryDepth);

    controller.setLineWrapping(false);
    const content = parent.querySelector<HTMLElement>('.cm-content');
    if (!content) throw new Error('CodeMirror content element was not created');
    content.dispatchEvent(new FocusEvent('focusin', { bubbles: true }));
    await vi.waitFor(() => {
      expect(parent.querySelector('.cm-foldGutter')).not.toBeNull();
    });

    controller.setHtmlAndResetHistory('<section>mass result</section>');

    expect(controller.getHtml()).toBe('<section>mass result</section>');
    expect(undoDepth(view.state)).toBe(0);
    expect(redoDepth(view.state)).toBe(0);
    expect(parent.querySelector('.cm-content')?.classList.contains('cm-lineWrapping')).toBe(false);
    expect(parent.querySelector('.cm-foldGutter')).not.toBeNull();
    controller.destroy();
  });
});
