import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { SourceEditorController } from '../../src/editor/source';
import type { SyncController } from '../../src/editor/sync';
import type { VisualEditorController } from '../../src/editor/visual';
import { createLayoutController, type LayoutController } from '../../src/ui/layout';

class FakeMediaQueryList extends EventTarget {
  matches: boolean;
  readonly media = '(max-width: 899px)';
  onchange: ((event: MediaQueryListEvent) => void) | null = null;

  constructor(matches: boolean) {
    super();
    this.matches = matches;
  }

  setMatches(matches: boolean): void {
    this.matches = matches;
    this.dispatchEvent(new Event('change'));
  }

  addListener(listener: (event: MediaQueryListEvent) => void): void {
    this.addEventListener('change', listener as EventListener);
  }

  removeListener(listener: (event: MediaQueryListEvent) => void): void {
    this.removeEventListener('change', listener as EventListener);
  }
}

class FakeVisualViewport extends EventTarget {
  height = 700;
  width = 900;
  offsetLeft = 0;
  offsetTop = 0;
  pageLeft = 0;
  pageTop = 0;
  scale = 1;
  onresize: ((event: Event) => void) | null = null;
  onscroll: ((event: Event) => void) | null = null;
  onscrollend: ((event: Event) => void) | null = null;
}

class FakeResizeObserver {
  static instances: FakeResizeObserver[] = [];

  readonly observe = vi.fn();
  readonly unobserve = vi.fn();
  readonly disconnect = vi.fn();

  constructor(private readonly callback: ResizeObserverCallback) {
    FakeResizeObserver.instances.push(this);
  }

  notify(): void {
    this.callback([], this as unknown as ResizeObserver);
  }
}

interface Harness {
  controller: LayoutController;
  media: FakeMediaQueryList;
  viewport: FakeVisualViewport | null;
  workspace: HTMLElement;
  visualPanel: HTMLElement;
  visualFocusTarget: HTMLButtonElement;
  sourcePanel: HTMLElement;
  splitter: HTMLElement;
  tabs: HTMLElement;
  visualTab: HTMLButtonElement;
  sourceTab: HTMLButtonElement;
  requestMeasure: ReturnType<typeof vi.fn>;
  hasFocus: ReturnType<typeof vi.fn>;
  visualHasFocus: ReturnType<typeof vi.fn>;
  flushActive: ReturnType<typeof vi.fn>;
  setPointerCapture: ReturnType<typeof vi.fn>;
  releasePointerCapture: ReturnType<typeof vi.fn>;
  observer: FakeResizeObserver;
  flushFrames: () => void;
}

const controllers: LayoutController[] = [];
let originalVisualViewport: PropertyDescriptor | undefined;
let originalInnerHeight: PropertyDescriptor | undefined;

const element = <T extends HTMLElement>(tag: string): T => document.createElement(tag) as T;

const createHarness = (options: {
  mobile?: boolean;
  viewport?: FakeVisualViewport | null;
  innerHeight?: number;
  sourceHasFocus?: boolean;
} = {}): Harness => {
  const media = new FakeMediaQueryList(options.mobile ?? false);
  const viewport = options.viewport === undefined ? new FakeVisualViewport() : options.viewport;
  Object.defineProperty(window, 'visualViewport', {
    configurable: true,
    value: viewport ?? undefined,
  });
  if (options.innerHeight !== undefined) {
    Object.defineProperty(window, 'innerHeight', {
      configurable: true,
      value: options.innerHeight,
    });
  }

  vi.stubGlobal('matchMedia', vi.fn(() => media as unknown as MediaQueryList));
  vi.stubGlobal('ResizeObserver', FakeResizeObserver);

  let nextFrame = 0;
  const frames = new Map<number, FrameRequestCallback>();
  vi.stubGlobal('requestAnimationFrame', vi.fn((callback: FrameRequestCallback): number => {
    nextFrame += 1;
    frames.set(nextFrame, callback);
    return nextFrame;
  }));
  vi.stubGlobal('cancelAnimationFrame', vi.fn((frame: number): void => {
    frames.delete(frame);
  }));

  const workspace = element<HTMLElement>('main');
  const visualPanel = element<HTMLElement>('section');
  const visualFocusTarget = element<HTMLButtonElement>('button');
  const sourcePanel = element<HTMLElement>('section');
  const splitter = element<HTMLElement>('div');
  const tabs = element<HTMLElement>('div');
  const visualTab = element<HTMLButtonElement>('button');
  const sourceTab = element<HTMLButtonElement>('button');
  visualTab.setAttribute('aria-selected', 'true');
  sourceTab.setAttribute('aria-selected', 'false');
  visualTab.tabIndex = 0;
  sourceTab.tabIndex = -1;
  visualFocusTarget.type = 'button';
  visualPanel.append(visualFocusTarget);
  tabs.append(visualTab, sourceTab);
  workspace.append(tabs, visualPanel, splitter, sourcePanel);
  document.body.append(workspace);

  workspace.getBoundingClientRect = vi.fn(() => ({
    bottom: 600,
    height: 600,
    left: 100,
    right: 1100,
    top: 0,
    width: 1000,
    x: 100,
    y: 0,
    toJSON: () => ({}),
  }));
  const setPointerCapture = vi.fn();
  const releasePointerCapture = vi.fn();
  Object.defineProperties(splitter, {
    setPointerCapture: { configurable: true, value: setPointerCapture },
    hasPointerCapture: { configurable: true, value: vi.fn(() => true) },
    releasePointerCapture: { configurable: true, value: releasePointerCapture },
  });

  const requestMeasure = vi.fn();
  const hasFocus = vi.fn(() => options.sourceHasFocus ?? false);
  const visualHasFocus = vi.fn(() => visualPanel.contains(document.activeElement));
  const flushActive = vi.fn();
  const controller = createLayoutController(
    { workspace, visualPanel, sourcePanel, splitter, tabs, visualTab, sourceTab },
    { requestMeasure, hasFocus } as unknown as SourceEditorController,
    { flushActive } as unknown as SyncController,
    { hasFocus: visualHasFocus } as Pick<VisualEditorController, 'hasFocus'>,
  );
  controllers.push(controller);

  const observer = FakeResizeObserver.instances.at(-1);
  if (!observer) throw new Error('Layout did not create a ResizeObserver');

  return {
    controller,
    media,
    viewport,
    workspace,
    visualPanel,
    visualFocusTarget,
    sourcePanel,
    splitter,
    tabs,
    visualTab,
    sourceTab,
    requestMeasure,
    hasFocus,
    visualHasFocus,
    flushActive,
    setPointerCapture,
    releasePointerCapture,
    observer,
    flushFrames: () => {
      const pending = [...frames.values()];
      frames.clear();
      pending.forEach((callback) => callback(0));
    },
  };
};

const keydown = (target: HTMLElement, key: string, shiftKey = false): KeyboardEvent => {
  const event = new KeyboardEvent('keydown', {
    bubbles: true,
    cancelable: true,
    key,
    shiftKey,
  });
  target.dispatchEvent(event);
  return event;
};

const pointer = (
  target: HTMLElement,
  type: string,
  clientX: number,
  pointerId = 1,
  button = 0,
): MouseEvent => {
  const event = new MouseEvent(type, {
    bubbles: true,
    button,
    cancelable: true,
    clientX,
  });
  Object.defineProperty(event, 'pointerId', { value: pointerId });
  target.dispatchEvent(event);
  return event;
};

describe('responsive layout controller', () => {
  beforeEach(() => {
    originalVisualViewport = Object.getOwnPropertyDescriptor(window, 'visualViewport');
    originalInnerHeight = Object.getOwnPropertyDescriptor(window, 'innerHeight');
    FakeResizeObserver.instances = [];
  });

  afterEach(() => {
    controllers.splice(0).forEach((controller) => controller.destroy());
    vi.unstubAllGlobals();
    if (originalVisualViewport) {
      Object.defineProperty(window, 'visualViewport', originalVisualViewport);
    } else {
      Reflect.deleteProperty(window, 'visualViewport');
    }
    if (originalInnerHeight) Object.defineProperty(window, 'innerHeight', originalInnerHeight);
    document.documentElement.style.removeProperty('--phe-viewport-height');
    document.documentElement.style.removeProperty('--phe-viewport-offset-top');
    document.body.replaceChildren();
  });

  it('initialises desktop split, viewport variables, observer, and source measurement', () => {
    const viewport = new FakeVisualViewport();
    viewport.height = 701.6;
    viewport.offsetTop = 11.5;
    const harness = createHarness({ viewport });

    expect(harness.tabs.hidden).toBe(true);
    expect(harness.splitter.hidden).toBe(false);
    expect(harness.workspace.classList.contains('is-mobile')).toBe(false);
    expect(harness.visualPanel.hidden).toBe(false);
    expect(harness.sourcePanel.hidden).toBe(false);
    expect(harness.workspace.style.getPropertyValue('--phe-visual-percent')).toBe('50%');
    expect(harness.splitter.getAttribute('aria-valuenow')).toBe('50');
    expect(document.documentElement.style.getPropertyValue('--phe-viewport-height')).toBe('702px');
    expect(document.documentElement.style.getPropertyValue('--phe-viewport-offset-top')).toBe('12px');
    expect(harness.observer.observe).toHaveBeenCalledWith(harness.sourcePanel);
    expect(harness.requestMeasure).toHaveBeenCalledTimes(2);

    harness.flushFrames();
    expect(harness.requestMeasure).toHaveBeenCalledTimes(3);
  });

  it('switches mobile panels through clicks and restores both panels on desktop', () => {
    const harness = createHarness();
    harness.flushFrames();
    harness.requestMeasure.mockClear();
    harness.flushActive.mockClear();

    harness.media.setMatches(true);
    expect(harness.tabs.hidden).toBe(false);
    expect(harness.splitter.hidden).toBe(true);
    expect(harness.workspace.classList.contains('is-mobile')).toBe(true);
    expect(harness.visualPanel.hidden).toBe(false);
    expect(harness.sourcePanel.hidden).toBe(true);
    expect(harness.flushActive).toHaveBeenCalledOnce();

    harness.sourceTab.click();
    expect(harness.visualTab.getAttribute('aria-selected')).toBe('false');
    expect(harness.sourceTab.getAttribute('aria-selected')).toBe('true');
    expect(harness.visualTab.tabIndex).toBe(-1);
    expect(harness.sourceTab.tabIndex).toBe(0);
    expect(harness.visualPanel.hidden).toBe(true);
    expect(harness.sourcePanel.hidden).toBe(false);
    expect(harness.requestMeasure).not.toHaveBeenCalled();
    harness.flushFrames();
    expect(harness.requestMeasure).toHaveBeenCalledOnce();

    harness.visualTab.click();
    expect(harness.visualPanel.hidden).toBe(false);
    expect(harness.sourcePanel.hidden).toBe(true);

    harness.media.setMatches(false);
    expect(harness.tabs.hidden).toBe(true);
    expect(harness.splitter.hidden).toBe(false);
    expect(harness.visualPanel.hidden).toBe(false);
    expect(harness.sourcePanel.hidden).toBe(false);
    harness.flushFrames();
    expect(harness.requestMeasure).toHaveBeenCalledTimes(2);
  });

  it('keeps a focused source panel visible when crossing into the mobile breakpoint', () => {
    const harness = createHarness({ sourceHasFocus: true });
    harness.flushActive.mockClear();

    harness.media.setMatches(true);

    expect(harness.hasFocus).toHaveBeenCalledOnce();
    expect(harness.flushActive).toHaveBeenCalledOnce();
    expect(harness.visualTab.getAttribute('aria-selected')).toBe('false');
    expect(harness.sourceTab.getAttribute('aria-selected')).toBe('true');
    expect(harness.visualPanel.hidden).toBe(true);
    expect(harness.sourcePanel.hidden).toBe(false);
  });

  it('keeps the focused visual panel visible when a stale mobile tab crosses the breakpoint', () => {
    const harness = createHarness();
    harness.flushFrames();

    harness.media.setMatches(true);
    harness.sourceTab.click();
    expect(harness.sourcePanel.hidden).toBe(false);

    harness.media.setMatches(false);
    harness.visualFocusTarget.focus();
    expect(document.activeElement).toBe(harness.visualFocusTarget);

    harness.media.setMatches(true);

    expect(harness.visualTab.getAttribute('aria-selected')).toBe('true');
    expect(harness.sourceTab.getAttribute('aria-selected')).toBe('false');
    expect(harness.visualPanel.hidden).toBe(false);
    expect(harness.sourcePanel.hidden).toBe(true);
  });

  it('implements roving tab focus with Arrow, Home, and End keys', () => {
    const harness = createHarness({ mobile: true });
    harness.flushActive.mockClear();

    const right = keydown(harness.visualTab, 'ArrowRight');
    expect(right.defaultPrevented).toBe(true);
    expect(document.activeElement).toBe(harness.sourceTab);
    expect(harness.sourceTab.getAttribute('aria-selected')).toBe('true');

    const home = keydown(harness.sourceTab, 'Home');
    expect(home.defaultPrevented).toBe(true);
    expect(document.activeElement).toBe(harness.visualTab);

    const end = keydown(harness.visualTab, 'End');
    expect(end.defaultPrevented).toBe(true);
    expect(document.activeElement).toBe(harness.sourceTab);

    const left = keydown(harness.sourceTab, 'ArrowLeft');
    expect(left.defaultPrevented).toBe(true);
    expect(document.activeElement).toBe(harness.visualTab);

    const unrelated = keydown(harness.visualTab, 'ArrowDown');
    expect(unrelated.defaultPrevented).toBe(false);
    expect(harness.flushActive).toHaveBeenCalledTimes(4);
  });

  it('moves and clamps the splitter from the keyboard', () => {
    const harness = createHarness();
    harness.requestMeasure.mockClear();

    expect(keydown(harness.splitter, 'ArrowRight').defaultPrevented).toBe(true);
    expect(harness.workspace.style.getPropertyValue('--phe-visual-percent')).toBe('52%');
    expect(keydown(harness.splitter, 'ArrowRight', true).defaultPrevented).toBe(true);
    expect(harness.workspace.style.getPropertyValue('--phe-visual-percent')).toBe('62%');
    keydown(harness.splitter, 'End');
    keydown(harness.splitter, 'ArrowRight');
    expect(harness.splitter.getAttribute('aria-valuenow')).toBe('70');
    keydown(harness.splitter, 'Home');
    keydown(harness.splitter, 'ArrowLeft');
    expect(harness.splitter.getAttribute('aria-valuenow')).toBe('30');

    const unrelated = keydown(harness.splitter, 'Enter');
    expect(unrelated.defaultPrevented).toBe(false);
    expect(harness.requestMeasure).toHaveBeenCalledTimes(6);
  });

  it('drags the desktop splitter and ignores other pointers and mobile drag', () => {
    const harness = createHarness();
    harness.requestMeasure.mockClear();

    const down = pointer(harness.splitter, 'pointerdown', 600, 7);
    expect(down.defaultPrevented).toBe(true);
    expect(harness.setPointerCapture).toHaveBeenCalledWith(7);
    expect(harness.splitter.classList.contains('is-dragging')).toBe(true);
    pointer(harness.splitter, 'pointermove', 900, 7);
    expect(harness.splitter.getAttribute('aria-valuenow')).toBe('70');
    pointer(harness.splitter, 'pointermove', 200, 8);
    expect(harness.splitter.getAttribute('aria-valuenow')).toBe('70');
    pointer(harness.splitter, 'pointerup', 900, 7);
    expect(harness.releasePointerCapture).toHaveBeenCalledWith(7);
    expect(harness.splitter.classList.contains('is-dragging')).toBe(false);

    pointer(harness.splitter, 'pointerdown', 300, 9, 1);
    expect(harness.setPointerCapture).toHaveBeenCalledTimes(1);
    harness.media.setMatches(true);
    pointer(harness.splitter, 'pointerdown', 300, 10);
    expect(harness.setPointerCapture).toHaveBeenCalledTimes(1);
  });

  it('tracks visual viewport resize and scroll, then requests CodeMirror measurement', () => {
    const viewport = new FakeVisualViewport();
    const harness = createHarness({ viewport });
    harness.requestMeasure.mockClear();

    viewport.height = 480.4;
    viewport.offsetTop = 115.6;
    viewport.dispatchEvent(new Event('resize'));
    expect(document.documentElement.style.getPropertyValue('--phe-viewport-height')).toBe('480px');
    expect(document.documentElement.style.getPropertyValue('--phe-viewport-offset-top')).toBe('116px');

    viewport.offsetTop = 130.2;
    viewport.dispatchEvent(new Event('scroll'));
    expect(document.documentElement.style.getPropertyValue('--phe-viewport-offset-top')).toBe('130px');

    window.dispatchEvent(new Event('resize'));
    harness.observer.notify();
    expect(harness.requestMeasure).toHaveBeenCalledTimes(4);
  });

  it('falls back to innerHeight and a zero offset without visualViewport', () => {
    const harness = createHarness({ viewport: null, innerHeight: 642.7 });

    expect(harness.viewport).toBeNull();
    expect(document.documentElement.style.getPropertyValue('--phe-viewport-height')).toBe('643px');
    expect(document.documentElement.style.getPropertyValue('--phe-viewport-offset-top')).toBe('0px');

    harness.requestMeasure.mockClear();
    Object.defineProperty(window, 'innerHeight', { configurable: true, value: 510.2 });
    window.dispatchEvent(new Event('resize'));
    expect(document.documentElement.style.getPropertyValue('--phe-viewport-height')).toBe('510px');
    expect(harness.requestMeasure).toHaveBeenCalledOnce();
  });

  it('removes every event listener and disconnects its observer on destroy', () => {
    const viewport = new FakeVisualViewport();
    const harness = createHarness({ viewport });
    harness.flushActive.mockClear();
    harness.requestMeasure.mockClear();
    const initialTabsHidden = harness.tabs.hidden;
    const initialSplit = harness.splitter.getAttribute('aria-valuenow');

    harness.controller.destroy();
    harness.sourceTab.click();
    keydown(harness.visualTab, 'ArrowRight');
    keydown(harness.splitter, 'ArrowRight');
    harness.media.setMatches(true);
    viewport.height = 300;
    viewport.offsetTop = 90;
    viewport.dispatchEvent(new Event('resize'));
    viewport.dispatchEvent(new Event('scroll'));
    window.dispatchEvent(new Event('resize'));

    expect(harness.flushActive).not.toHaveBeenCalled();
    expect(harness.requestMeasure).not.toHaveBeenCalled();
    expect(harness.tabs.hidden).toBe(initialTabsHidden);
    expect(harness.splitter.getAttribute('aria-valuenow')).toBe(initialSplit);
    expect(harness.observer.disconnect).toHaveBeenCalledOnce();
  });

  it('does not measure a destroyed source editor from queued animation frames', () => {
    const harness = createHarness();
    harness.media.setMatches(true);
    harness.sourceTab.click();
    harness.requestMeasure.mockClear();

    harness.controller.destroy();
    harness.flushFrames();

    expect(harness.requestMeasure).not.toHaveBeenCalled();
  });
});
