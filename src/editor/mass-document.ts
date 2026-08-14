/*! @license GPL-2.0-or-later | https://github.com/phphtmledit/editor */
import type { ProgrammaticMutationGuard } from './mutation-guard';
import {
  createMassUndoStack,
  type MassUndoStack,
  type MassUndoState,
} from './mass-undo';
import type { SourceEditorController } from './source';
import type { VisualEditorController } from './visual';

type Listener = (state: MassUndoState) => void;

type MassSourcePort = Pick<
  SourceEditorController,
  'setHtmlAndResetHistory'
>;

type MassVisualPort = Pick<
  VisualEditorController,
  'setHtmlAndResetHistory'
>;

export interface MassOperationResult {
  readonly html: string;
  readonly label: string;
}

export interface MassDocumentController {
  apply: (label: string, html: string, snapshotHtml: string) => MassOperationResult;
  undo: () => MassOperationResult | null;
  getUndoState: () => MassUndoState;
  onUndoStateChange: (listener: Listener) => () => void;
}

export const createMassDocumentController = (
  visual: MassVisualPort,
  source: MassSourcePort,
  mutationGuard: ProgrammaticMutationGuard,
  undoStack: MassUndoStack = createMassUndoStack(),
): MassDocumentController => {
  const listeners = new Set<Listener>();

  const writeBothAndResetHistories = (html: string): string => mutationGuard.run(() => {
    const normalized = visual.setHtmlAndResetHistory(html);
    source.setHtmlAndResetHistory(normalized);
    return normalized;
  });

  const emitUndoState = (): void => {
    const state = undoStack.getState();
    listeners.forEach((listener) => listener(state));
  };

  return {
    apply: (label, html, snapshotHtml) => {
      if (html === snapshotHtml) return { html, label };

      // Crossing the mass-write boundary resets both native histories. Keep the
      // application snapshot before that boundary, even when TinyMCE later
      // normalizes the proposed HTML back to the same serialized document.
      undoStack.push(snapshotHtml, label);
      emitUndoState();
      const normalized = writeBothAndResetHistories(html);
      return { html: normalized, label };
    },
    undo: () => {
      const snapshot = undoStack.pop();
      if (!snapshot) return null;

      try {
        const html = writeBothAndResetHistories(snapshot.html);
        emitUndoState();
        return { html, label: snapshot.label };
      } catch (error: unknown) {
        undoStack.push(snapshot.html, snapshot.label);
        throw error;
      }
    },
    getUndoState: () => undoStack.getState(),
    onUndoStateChange: (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
};
