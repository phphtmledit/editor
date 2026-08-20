import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { applyStaticUi, STATIC_UI } from '../../src/ui/strings';

const root = resolve(import.meta.dirname, '../..');
const indexHtml = readFileSync(join(root, 'index.html'), 'utf8');
const css = readFileSync(join(root, 'src/styles/app.css'), 'utf8');

const actionLabels = new Map([
  ['choose-import-file', { icon: 'folder-open', label: STATIC_UI.openFile }],
  ['export-html', { icon: 'download', label: STATIC_UI.downloadHtml }],
  ['copy-html', { icon: 'copy-code', label: STATIC_UI.copyHtml }],
  ['copy-text', { icon: 'copy-text', label: STATIC_UI.copyText }],
  ['load-example', { icon: 'sparkles', label: STATIC_UI.loadExample }],
  ['new-document', { icon: 'file-plus', label: STATIC_UI.newDocument }],
]);

describe('top action icons', () => {
  it('gives every action one decorative, vector icon and a visible text label', () => {
    const parsed = new DOMParser().parseFromString(indexHtml, 'text/html');
    const iconDrawings = new Set<string>();

    actionLabels.forEach(({ icon: expectedIcon, label: expectedLabel }, id) => {
      const button = parsed.querySelector<HTMLButtonElement>(`#${id}`);
      const icon = button?.querySelector<SVGElement>('svg.io-action-icon');
      const label = button?.querySelector<HTMLElement>('.io-action-label');

      expect(button, id).not.toBeNull();
      expect(icon?.getAttribute('viewBox'), id).toBe('0 0 24 24');
      expect(icon?.getAttribute('data-icon'), id).toBe(expectedIcon);
      expect(icon?.getAttribute('aria-hidden'), id).toBe('true');
      expect(icon?.getAttribute('focusable'), id).toBe('false');
      expect(icon?.querySelectorAll('path').length, id).toBeGreaterThan(0);
      expect(icon?.querySelector('title'), id).toBeNull();
      const copyKey = [...Object.entries(STATIC_UI)]
        .find(([, value]) => value === expectedLabel)?.[0];
      expect(label?.textContent, id).toContain(`{{phe:${copyKey}}}`);
      iconDrawings.add(icon?.innerHTML.replace(/\s+/g, ' ').trim() ?? '');
    });

    expect(iconDrawings.size).toBe(actionLabels.size);
  });

  it('preserves every icon when static copy is hydrated repeatedly', () => {
    const parsed = new DOMParser().parseFromString(indexHtml, 'text/html');
    const before = [...parsed.querySelectorAll('.io-action-icon')].map((icon) => icon.outerHTML);

    applyStaticUi(parsed);
    applyStaticUi(parsed);

    expect([...parsed.querySelectorAll('.io-action-icon')].map((icon) => icon.outerHTML)).toEqual(before);
    actionLabels.forEach(({ label: expectedLabel }, id) => {
      expect(parsed.querySelector(`#${id} .io-action-label`)?.textContent).toBe(expectedLabel);
      expect(parsed.querySelector(`#${id}`)?.textContent?.trim()).toBe(expectedLabel);
    });
  });

  it('uses one token-driven, current-color icon style with no independent palette', () => {
    const rule = css.match(/\.io-action-icon\s*\{([^}]*)\}/s)?.[1] ?? '';
    expect(rule).toContain('width: 18px');
    expect(rule).toContain('height: 18px');
    expect(rule).toContain('fill: none');
    expect(rule).toContain('stroke: currentColor');
    expect(rule).toContain('stroke-width: 1.8');
    expect(rule).not.toMatch(/#[0-9a-f]{3,8}|rgba?\(|hsla?\(/i);
    expect(css).toMatch(/\.io-actions button:not\(\.primary-action\) \.io-action-icon\s*\{\s*color:\s*var\(--phe-accent\);\s*\}/);
  });
});
