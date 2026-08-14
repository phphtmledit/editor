/*! @license GPL-2.0-or-later | https://github.com/phphtmledit/editor */
import type { SourceEditorController } from '../editor/source';
import type { SyncController } from '../editor/sync';
import type { VisualEditorController } from '../editor/visual';

type Panel = 'visual' | 'source';

interface LayoutElements {
  workspace: HTMLElement;
  visualPanel: HTMLElement;
  sourcePanel: HTMLElement;
  splitter: HTMLElement;
  tabs: HTMLElement;
  visualTab: HTMLButtonElement;
  sourceTab: HTMLButtonElement;
}

export interface LayoutController {
  destroy: () => void;
}

export const createLayoutController = (
  elements: LayoutElements,
  source: SourceEditorController,
  sync: SyncController,
  visual: Pick<VisualEditorController, 'hasFocus'>,
): LayoutController => {
  const media = matchMedia('(max-width: 899px)');
  const cleanups: Array<() => void> = [];
  let activePanel: Panel = 'visual';
  let split = 50;
  let dragPointer: number | null = null;
  let destroyed = false;
  const scheduledFrames = new Set<number>();

  const requestSourceMeasure = (): void => {
    if (destroyed) return;
    const frame = requestAnimationFrame(() => {
      scheduledFrames.delete(frame);
      if (!destroyed) source.requestMeasure();
    });
    scheduledFrames.add(frame);
  };

  const setActivePanel = (panel: Panel, focusTab = false): void => {
    sync.flushActive();
    activePanel = panel;
    const visualActive = panel === 'visual';
    elements.visualTab.setAttribute('aria-selected', String(visualActive));
    elements.sourceTab.setAttribute('aria-selected', String(!visualActive));
    elements.visualTab.tabIndex = visualActive ? 0 : -1;
    elements.sourceTab.tabIndex = visualActive ? -1 : 0;
    if (media.matches) {
      elements.visualPanel.hidden = !visualActive;
      elements.sourcePanel.hidden = visualActive;
      if (!visualActive) requestSourceMeasure();
    }
    if (focusTab) (visualActive ? elements.visualTab : elements.sourceTab).focus();
  };

  const updateMode = (): void => {
    const mobile = media.matches;
    elements.tabs.hidden = !mobile;
    elements.splitter.hidden = mobile;
    elements.workspace.classList.toggle('is-mobile', mobile);
    if (mobile) {
      if (source.hasFocus()) activePanel = 'source';
      else if (visual.hasFocus()) activePanel = 'visual';
      setActivePanel(activePanel);
    } else {
      elements.visualPanel.hidden = false;
      elements.sourcePanel.hidden = false;
      requestSourceMeasure();
    }
  };

  const applySplit = (next: number): void => {
    split = Math.min(70, Math.max(30, Math.round(next)));
    elements.workspace.style.setProperty('--phe-visual-percent', `${split}%`);
    elements.splitter.setAttribute('aria-valuenow', String(split));
    source.requestMeasure();
  };

  const splitFromPointer = (event: PointerEvent): void => {
    const bounds = elements.workspace.getBoundingClientRect();
    if (bounds.width > 0) applySplit(((event.clientX - bounds.left) / bounds.width) * 100);
  };

  const onPointerDown = (event: PointerEvent): void => {
    if (event.button !== 0 || media.matches) return;
    dragPointer = event.pointerId;
    elements.splitter.setPointerCapture(event.pointerId);
    elements.splitter.classList.add('is-dragging');
    splitFromPointer(event);
    event.preventDefault();
  };
  const onPointerMove = (event: PointerEvent): void => {
    if (dragPointer !== event.pointerId) return;
    splitFromPointer(event);
  };
  const finishDrag = (event: PointerEvent): void => {
    if (dragPointer !== event.pointerId) return;
    dragPointer = null;
    elements.splitter.classList.remove('is-dragging');
    if (elements.splitter.hasPointerCapture(event.pointerId)) {
      elements.splitter.releasePointerCapture(event.pointerId);
    }
  };
  const onSplitterKey = (event: KeyboardEvent): void => {
    const step = event.shiftKey ? 10 : 2;
    if (event.key === 'ArrowLeft') applySplit(split - step);
    else if (event.key === 'ArrowRight') applySplit(split + step);
    else if (event.key === 'Home') applySplit(30);
    else if (event.key === 'End') applySplit(70);
    else return;
    event.preventDefault();
  };

  const onTabKey = (event: KeyboardEvent): void => {
    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
    const next: Panel = event.key === 'ArrowLeft' || event.key === 'Home' ? 'visual' : 'source';
    setActivePanel(next, true);
    event.preventDefault();
  };

  const onVisualTabClick = (): void => setActivePanel('visual');
  const onSourceTabClick = (): void => setActivePanel('source');
  const visualViewport = window.visualViewport;

  const updateViewport = (): void => {
    const height = visualViewport?.height ?? window.innerHeight;
    const offsetTop = visualViewport?.offsetTop ?? 0;
    document.documentElement.style.setProperty('--phe-viewport-height', `${Math.round(height)}px`);
    document.documentElement.style.setProperty(
      '--phe-viewport-offset-top',
      `${Math.round(offsetTop)}px`,
    );
    source.requestMeasure();
  };

  elements.visualTab.addEventListener('click', onVisualTabClick);
  elements.sourceTab.addEventListener('click', onSourceTabClick);
  elements.visualTab.addEventListener('keydown', onTabKey);
  elements.sourceTab.addEventListener('keydown', onTabKey);
  elements.splitter.addEventListener('pointerdown', onPointerDown);
  elements.splitter.addEventListener('pointermove', onPointerMove);
  elements.splitter.addEventListener('pointerup', finishDrag);
  elements.splitter.addEventListener('pointercancel', finishDrag);
  elements.splitter.addEventListener('keydown', onSplitterKey);
  media.addEventListener('change', updateMode);
  window.addEventListener('resize', updateViewport);
  visualViewport?.addEventListener('resize', updateViewport);
  visualViewport?.addEventListener('scroll', updateViewport);

  const observer = new ResizeObserver(() => {
    if (!destroyed) source.requestMeasure();
  });
  observer.observe(elements.sourcePanel);
  cleanups.push(() => observer.disconnect());

  updateViewport();
  applySplit(split);
  updateMode();

  return {
    destroy: () => {
      if (destroyed) return;
      destroyed = true;
      scheduledFrames.forEach((frame) => cancelAnimationFrame(frame));
      scheduledFrames.clear();
      cleanups.forEach((cleanup) => cleanup());
      media.removeEventListener('change', updateMode);
      window.removeEventListener('resize', updateViewport);
      visualViewport?.removeEventListener('resize', updateViewport);
      visualViewport?.removeEventListener('scroll', updateViewport);
      elements.visualTab.removeEventListener('click', onVisualTabClick);
      elements.sourceTab.removeEventListener('click', onSourceTabClick);
      elements.visualTab.removeEventListener('keydown', onTabKey);
      elements.sourceTab.removeEventListener('keydown', onTabKey);
      elements.splitter.removeEventListener('pointerdown', onPointerDown);
      elements.splitter.removeEventListener('pointermove', onPointerMove);
      elements.splitter.removeEventListener('pointerup', finishDrag);
      elements.splitter.removeEventListener('pointercancel', finishDrag);
      elements.splitter.removeEventListener('keydown', onSplitterKey);
    },
  };
};
