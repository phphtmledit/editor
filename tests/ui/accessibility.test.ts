import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { beforeEach, describe, expect, it } from 'vitest';
import { applyStaticUi } from '../../src/ui/strings';

const markup = readFileSync(resolve(import.meta.dirname, '../../index.html'), 'utf8');

describe('application accessibility structure', () => {
  let page: Document;

  beforeEach(() => {
    page = new DOMParser().parseFromString(markup, 'text/html');
    applyStaticUi(page);
  });

  it('uses unique ids and resolvable ARIA references', () => {
    const ids = [...page.querySelectorAll<HTMLElement>('[id]')].map((element) => element.id);
    expect(new Set(ids).size).toBe(ids.length);

    page.querySelectorAll<HTMLElement>('[aria-controls], [aria-labelledby], [aria-describedby]')
      .forEach((element) => {
        ['aria-controls', 'aria-labelledby', 'aria-describedby'].forEach((attribute) => {
          const references = element.getAttribute(attribute)?.split(/\s+/).filter(Boolean) ?? [];
          references.forEach((reference) => expect(page.getElementById(reference)).not.toBeNull());
        });
      });
  });

  it('exposes the mobile tab pattern and keyboard splitter semantics', () => {
    const tabs = [...page.querySelectorAll<HTMLElement>('[role="tab"]')];
    expect(page.querySelector('[role="tablist"]')).not.toBeNull();
    expect(tabs).toHaveLength(2);
    expect(tabs.map((tab) => tab.getAttribute('aria-selected'))).toEqual(['true', 'false']);
    expect(page.querySelectorAll('[role="tabpanel"]')).toHaveLength(2);

    const splitter = page.querySelector<HTMLElement>('[role="separator"]');
    expect(splitter?.tabIndex).toBe(0);
    expect(splitter?.getAttribute('aria-orientation')).toBe('vertical');
    expect(splitter?.getAttribute('aria-valuemin')).toBe('30');
    expect(splitter?.getAttribute('aria-valuemax')).toBe('70');
  });

  it('provides named controls and live feedback instead of silent states', () => {
    page.querySelectorAll<HTMLButtonElement>('button').forEach((button) => {
      expect((button.textContent ?? '').trim() || button.getAttribute('aria-label')).toBeTruthy();
    });
    expect(page.querySelector('#loading-skeleton[role="status"]')).not.toBeNull();
    expect(page.querySelector('#io-result[role="status"][aria-live="polite"]')).not.toBeNull();
    expect(page.querySelector('#normalization-note[role="status"][aria-live="polite"]')).not.toBeNull();
    expect(page.querySelector('#app-error[role="alert"]')).not.toBeNull();
    expect(page.querySelector<HTMLInputElement>('#import-file-input')?.hidden).toBe(true);
  });
});
