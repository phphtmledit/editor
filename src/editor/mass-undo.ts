/*! @license GPL-2.0-or-later | https://github.com/phphtmledit/editor */

export const MASS_UNDO_MAX_SNAPSHOTS = 10;
export const MASS_UNDO_MAX_BYTES = 20 * 1024 * 1024;

export interface MassOperationSnapshot {
  readonly html: string;
  readonly label: string;
  readonly byteSize: number;
}

export interface MassUndoState {
  readonly count: number;
  readonly totalBytes: number;
  readonly nextLabel: string | null;
}

export interface MassUndoStack {
  push: (html: string, label: string) => void;
  pop: () => MassOperationSnapshot | null;
  getState: () => MassUndoState;
}

const utf8Encoder = new TextEncoder();

export const createMassUndoStack = (): MassUndoStack => {
  const snapshots: MassOperationSnapshot[] = [];
  let totalBytes = 0;

  const evictOverflow = (): void => {
    while (
      snapshots.length > MASS_UNDO_MAX_SNAPSHOTS ||
      totalBytes > MASS_UNDO_MAX_BYTES
    ) {
      const evicted = snapshots.shift();
      if (!evicted) break;
      totalBytes -= evicted.byteSize;
    }
  };

  return {
    push: (html, label) => {
      const snapshot: MassOperationSnapshot = {
        html,
        label,
        byteSize: utf8Encoder.encode(html).byteLength,
      };
      snapshots.push(snapshot);
      totalBytes += snapshot.byteSize;
      evictOverflow();
    },
    pop: () => {
      const snapshot = snapshots.pop();
      if (!snapshot) return null;
      totalBytes -= snapshot.byteSize;
      return snapshot;
    },
    getState: () => ({
      count: snapshots.length,
      totalBytes,
      nextLabel: snapshots[snapshots.length - 1]?.label ?? null,
    }),
  };
};
