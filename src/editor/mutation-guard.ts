/*! @license GPL-2.0-or-later | https://github.com/phphtmledit/editor */

export interface ProgrammaticMutationGuard {
  isActive: () => boolean;
  onStart: (listener: () => void) => () => void;
  run: <Result>(operation: () => Result) => Result;
}

export const createProgrammaticMutationGuard = (): ProgrammaticMutationGuard => {
  let depth = 0;
  const startListeners = new Set<() => void>();

  return {
    isActive: () => depth > 0,
    onStart: (listener) => {
      startListeners.add(listener);
      return () => startListeners.delete(listener);
    },
    run: <Result>(operation: () => Result): Result => {
      const isOutermost = depth === 0;
      depth += 1;
      try {
        if (isOutermost) startListeners.forEach((listener) => listener());
        return operation();
      } finally {
        depth -= 1;
      }
    },
  };
};
