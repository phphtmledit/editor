/*! @license GPL-2.0-or-later | https://github.com/phphtmledit/editor */
import { describe, expect, it } from 'vitest';
import {
  MASS_UNDO_MAX_BYTES,
  MASS_UNDO_MAX_SNAPSHOTS,
  createMassUndoStack,
} from '../../src/editor/mass-undo';

describe('mass operation undo stack', () => {
  it('keeps one chronological stack and exposes the latest operation label', () => {
    const stack = createMassUndoStack();
    stack.push('<p>before clean</p>', 'Clean document');
    stack.push('<p>before replace</p>', 'Replace all');

    expect(stack.getState()).toMatchObject({
      count: 2,
      nextLabel: 'Replace all',
    });
    expect(stack.pop()).toMatchObject({
      html: '<p>before replace</p>',
      label: 'Replace all',
    });
    expect(stack.getState().nextLabel).toBe('Clean document');
  });

  it('evicts the oldest snapshots beyond the ten-snapshot depth', () => {
    const stack = createMassUndoStack();
    for (let index = 0; index <= MASS_UNDO_MAX_SNAPSHOTS; index += 1) {
      stack.push(`<p>${index}</p>`, `Operation ${index}`);
    }

    expect(stack.getState().count).toBe(MASS_UNDO_MAX_SNAPSHOTS);
    for (let index = MASS_UNDO_MAX_SNAPSHOTS; index >= 1; index -= 1) {
      expect(stack.pop()?.label).toBe(`Operation ${index}`);
    }
    expect(stack.pop()).toBeNull();
  });

  it('evicts oldest snapshots when their UTF-8 total exceeds 20 MiB', () => {
    const stack = createMassUndoStack();
    const elevenMiB = 'x'.repeat(11 * 1024 * 1024);
    stack.push(elevenMiB, 'First large operation');
    stack.push(elevenMiB, 'Second large operation');

    expect(stack.getState()).toEqual({
      count: 1,
      totalBytes: elevenMiB.length,
      nextLabel: 'Second large operation',
    });
    expect(stack.getState().totalBytes).toBeLessThanOrEqual(MASS_UNDO_MAX_BYTES);
  });

  it('does not retain a single snapshot larger than the byte cap', () => {
    const stack = createMassUndoStack();
    stack.push('x'.repeat(MASS_UNDO_MAX_BYTES + 1), 'Oversized operation');

    expect(stack.getState()).toEqual({ count: 0, totalBytes: 0, nextLabel: null });
  });

  it('counts multibyte HTML as UTF-8 bytes', () => {
    const stack = createMassUndoStack();
    stack.push('é🙂', 'Unicode operation');

    expect(stack.getState().totalBytes).toBe(6);
  });
});
