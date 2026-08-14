/*! @license GPL-2.0-or-later | https://github.com/phphtmledit/editor */
import { describe, expect, it, vi } from 'vitest';
import { createProgrammaticMutationGuard } from '../../src/editor/mutation-guard';

describe('programmatic mutation guard', () => {
  it('stays active through nested writes and notifies only for the outer write', () => {
    const guard = createProgrammaticMutationGuard();
    const onStart = vi.fn(() => expect(guard.isActive()).toBe(true));
    guard.onStart(onStart);

    guard.run(() => {
      expect(guard.isActive()).toBe(true);
      guard.run(() => expect(guard.isActive()).toBe(true));
      expect(guard.isActive()).toBe(true);
    });

    expect(guard.isActive()).toBe(false);
    expect(onStart).toHaveBeenCalledTimes(1);
  });

  it('always leaves the guard after an exception', () => {
    const guard = createProgrammaticMutationGuard();

    expect(() => guard.run(() => {
      throw new Error('write failed');
    })).toThrow('write failed');
    expect(guard.isActive()).toBe(false);
  });

  it('allows start listeners to unsubscribe', () => {
    const guard = createProgrammaticMutationGuard();
    const onStart = vi.fn();
    const unsubscribe = guard.onStart(onStart);

    unsubscribe();
    guard.run(() => undefined);

    expect(onStart).not.toHaveBeenCalled();
  });
});
