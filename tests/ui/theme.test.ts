import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const visualSource = readFileSync(
  resolve(import.meta.dirname, '../../src/editor/visual.ts'),
  'utf8',
);

describe('application theme configuration', () => {
  beforeEach(() => {
    vi.resetModules();
    window.history.replaceState({}, '', '/');
    document.documentElement.removeAttribute('data-theme');
  });

  afterEach(() => {
    window.history.replaceState({}, '', '/');
    document.documentElement.removeAttribute('data-theme');
  });

  it.each([
    ['', null],
    ['?theme=light', 'light'],
    ['?theme=dark', 'dark'],
    ['?theme=auto', 'auto'],
    ['?theme=sepia', 'sepia'],
    ['?theme=', ''],
  ])('preserves the requested value from %s and always resolves light', async (search, requested) => {
    const { readAppConfig } = await import('../../src/config');

    expect(readAppConfig(search)).toEqual({
      requestedTheme: requested,
      resolvedTheme: 'light',
    });
  });

  it('applies the resolved theme to a supplied root element', async () => {
    const { applyAppConfig } = await import('../../src/config');
    const root = document.createElement('div');
    root.dataset.theme = 'dark';

    applyAppConfig({ requestedTheme: 'dark', resolvedTheme: 'light' }, root);

    expect(root.dataset.theme).toBe('light');
  });

  it('reads and applies the browser configuration when the module is loaded', async () => {
    window.history.replaceState({}, '', '/editor?theme=unknown&embed=1');

    const { appConfig } = await import('../../src/config');

    expect(appConfig).toEqual({
      requestedTheme: 'unknown',
      resolvedTheme: 'light',
    });
    expect(document.documentElement.dataset.theme).toBe('light');
  });

  it('pins TinyMCE to the light assets for every requested theme', () => {
    expect(visualSource).toMatch(/skin:\s*['"]oxide['"]/);
    expect(visualSource).toMatch(/content_css:\s*['"]default['"]/);
    expect(visualSource).not.toMatch(/oxide-dark|content_css:\s*['"]dark['"]/);
  });

  it('bridges the application color tokens into the isolated TinyMCE iframe', () => {
    expect(visualSource).toMatch(/content_style:\s*[A-Za-z_$][\w$]*\s*\(/);
    [
      '--phe-accent',
      '--phe-accent-soft',
      '--phe-bg',
      '--phe-surface',
      '--phe-border',
      '--phe-text',
      '--phe-text-muted',
    ].forEach((token) => expect(visualSource).toContain(token));
    expect(visualSource).toContain('color-scheme: light');
  });
});
