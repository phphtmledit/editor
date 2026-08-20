import { readFileSync, readdirSync } from 'node:fs';
import { extname, join, relative, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { applyStaticUi, STATIC_UI, VISUAL_UI } from '../../src/ui/strings';

const root = resolve(import.meta.dirname, '../..');
const indexHtml = readFileSync(join(root, 'index.html'), 'utf8');

const sourceFiles = (directory: string): string[] => readdirSync(directory, { withFileTypes: true })
  .flatMap((entry) => {
    const path = join(directory, entry.name);
    return entry.isDirectory() ? sourceFiles(path) : [path];
  })
  .filter((path) => ['.ts', '.css', '.js', '.cjs'].includes(extname(path)))
  .filter((path) => !relative(root, path).replaceAll('\\', '/').startsWith('src/e0/'));

const productFiles = [join(root, 'index.html'), ...sourceFiles(join(root, 'src'))];
const productSource = productFiles
  .map((path) => `/* ${relative(root, path).replaceAll('\\', '/')} */\n${readFileSync(path, 'utf8')}`)
  .join('\n');

interface StaticHtmlPlugin {
  readonly name?: string;
  readonly transformIndexHtml?:
    | ((html: string) => unknown)
    | { readonly handler?: (html: string) => unknown };
}

const transformStaticHtml = async (): Promise<string> => {
  const { loadConfigFromFile } = await import('vite');
  const loaded = await loadConfigFromFile({
    command: 'build',
    mode: 'production',
    isSsrBuild: false,
    isPreview: false,
  }, join(root, 'vite.config.ts'));
  if (!loaded) throw new Error('Vite configuration could not be loaded');
  const config = loaded.config;
  const plugin = (config.plugins ?? []).flat(Infinity).find((candidate): candidate is StaticHtmlPlugin =>
    typeof candidate === 'object' && candidate !== null &&
    (candidate as StaticHtmlPlugin).name === 'phphtmledit-static-ui-copy');
  if (!plugin) throw new Error('Static UI HTML transform plugin is missing');

  const transform = plugin.transformIndexHtml;
  const handler = typeof transform === 'function' ? transform : transform?.handler;
  if (!handler) throw new Error('Static UI HTML transform handler is missing');
  const result = await handler(indexHtml);
  if (typeof result !== 'string') throw new Error('Static UI HTML transform did not return HTML');
  return result;
};

describe('English application copy', () => {
  it('hydrates every static control and accessibility label from the central copy module', () => {
    const parsed = new DOMParser().parseFromString(indexHtml, 'text/html');
    applyStaticUi(parsed);

    expect(parsed.documentElement.lang).toBe('en');
    expect(parsed.title).toBe(STATIC_UI.documentTitle);
    expect(parsed.querySelector('meta[name="description"]')?.getAttribute('content'))
      .toBe(STATIC_UI.metaDescription);
    expect(parsed.querySelector('.privacy-note')?.textContent).toBe(STATIC_UI.privacyNote);

    parsed.querySelectorAll<HTMLButtonElement>('button').forEach((button) => {
      expect((button.textContent ?? '').trim() || button.getAttribute('aria-label')).toBeTruthy();
    });
    [
      '#io-tools',
      '.mobile-tabs',
      '#editor-workspace',
      '#visual-editor',
      '#editor-splitter',
      '#source-editor',
      '#document-tools',
    ].forEach((selector) => {
      expect(parsed.querySelector(selector)?.getAttribute('aria-label')).toBeTruthy();
    });
  });

  it('resolves every static {{phe:key}} placeholder through the production HTML transform', async () => {
    const keys = [...indexHtml.matchAll(/\{\{phe:([A-Za-z0-9]+)\}\}/g)]
      .map((match) => match[1]);
    expect(keys.length).toBeGreaterThan(0);
    keys.forEach((key) => {
      expect(typeof STATIC_UI[key as keyof typeof STATIC_UI], `Unknown static UI key: ${key}`)
        .toBe('string');
    });

    const transformed = await transformStaticHtml();
    expect(transformed).not.toMatch(/\{\{phe:/);
    const parsed = new DOMParser().parseFromString(transformed, 'text/html');
    expect(parsed.title).toBe(STATIC_UI.documentTitle);
    expect(parsed.querySelector('.privacy-note')?.textContent).toBe(STATIC_UI.privacyNote);
    expect(parsed.querySelector('#app-error h2')?.textContent).toBe(STATIC_UI.errorTitle);
  });

  it('contains no Cyrillic product copy outside the Russian specification documents', () => {
    const offenders = productFiles.filter((path) => /[А-Яа-яЁё]/u.test(readFileSync(path, 'utf8')));
    expect(offenders).toEqual([]);
  });

  it('uses TinyMCE built-in English and stable English date/time formats', () => {
    const visualSource = readFileSync(join(root, 'src/editor/visual.ts'), 'utf8');
    expect(visualSource).toContain("language: 'en'");
    expect(visualSource).toContain("insertdatetime_dateformat: '%Y-%m-%d'");
    expect(visualSource).toContain("insertdatetime_timeformat: '%H:%M:%S'");
    expect(visualSource).toContain('block_formats: VISUAL_UI.blockFormats');
    expect(VISUAL_UI.blockFormats).toContain('Paragraph=p');
    expect(visualSource).not.toMatch(/langs\//);
  });

  it('centralizes the English copy for the E5 About menu', () => {
    expect(VISUAL_UI).toMatchObject({
      aboutMenu: 'About',
      sourceCode: 'Source code',
      thirdPartyNotices: 'Third-party notices',
    });

    const visualSource = readFileSync(join(root, 'src/editor/visual.ts'), 'utf8');
    expect(visualSource).toContain('VISUAL_UI.aboutMenu');
    expect(visualSource).toContain('VISUAL_UI.sourceCode');
    expect(visualSource).toContain('VISUAL_UI.thirdPartyNotices');
    expect(visualSource).not.toMatch(/['"](?:About|Source code|Third-party notices)['"]/);
  });
});
