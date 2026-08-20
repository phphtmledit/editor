import { defineConfig, loadEnv, type Plugin } from 'vite';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { appendEmojilibToCanonicalLicenses } from './scripts/embedded-licenses.mjs';
import { mammothBrowserAliases } from './scripts/mammoth-browser-aliases.mjs';
import { STATIC_UI } from './src/ui/strings.ts';
import { DEFAULT_FRAME_ANCESTORS, pagesHeadersPlugin } from './scripts/pages-headers.mjs';

const projectRoot = fileURLToPath(new URL('.', import.meta.url));
const sourceUrl = 'https://github.com/phphtmledit/editor';
const noticesUrl = '/licenses.txt';
const bundleBanner = `/*! @license GPL-2.0-or-later
 * Source: ${sourceUrl}
 * Third-party notices: ${noticesUrl}
 */`;

const embeddedLicensesPlugin = (outDir: string): Plugin => ({
  name: 'phphtmledit-embedded-licenses',
  apply: 'build',
  writeBundle: async (outputOptions) => {
    await appendEmojilibToCanonicalLicenses(
      projectRoot,
      typeof outputOptions.dir === 'string' ? outputOptions.dir : outDir,
    );
  },
});

const escapeHtml = (value: string): string => value
  .replaceAll('&', '&amp;')
  .replaceAll('<', '&lt;')
  .replaceAll('>', '&gt;')
  .replaceAll('"', '&quot;')
  .replaceAll("'", '&#39;');

const staticUiHtmlPlugin = (): Plugin => ({
  name: 'phphtmledit-static-ui-copy',
  transformIndexHtml: {
    order: 'pre',
    handler: (html) => {
      const transformed = html.replace(/\{\{phe:([A-Za-z0-9]+)\}\}/g, (token, key: string) => {
        const value = STATIC_UI[key as keyof typeof STATIC_UI];
        if (typeof value !== 'string') throw new Error(`Unknown static UI copy token: ${token}`);
        return escapeHtml(value);
      });
      if (transformed.includes('{{phe:')) {
        throw new Error('An unresolved static UI copy token remains in index.html');
      }
      return transformed;
    },
  },
});

export default defineConfig(({ mode }) => {
  const diagnostic = mode === 'e0';
  const outDir = diagnostic ? 'dist-e0' : 'dist';
  const environment = loadEnv(mode, projectRoot, '');
  const frameAncestors = environment.FRAME_ANCESTORS || DEFAULT_FRAME_ANCESTORS;
  const diagnosticHtml = diagnostic
    ? readFileSync(new URL('./src/e0/index.html', import.meta.url), 'utf8')
    : '';

  return {
    resolve: {
      alias: mammothBrowserAliases(projectRoot),
    },
    plugins: [
      ...(!diagnostic ? [staticUiHtmlPlugin()] : []),
      ...(diagnostic
        ? [
          {
            name: 'phphtmledit-e0-html',
            transformIndexHtml: {
              order: 'pre' as const,
              handler: () => diagnosticHtml,
            },
          },
        ]
        : []),
      embeddedLicensesPlugin(outDir),
      pagesHeadersPlugin(frameAncestors),
    ],
    define: {
      __E0_DIAGNOSTIC__: JSON.stringify(diagnostic),
    },
    worker: {
      format: 'es',
      rolldownOptions: {
        output: {
          comments: {
            legal: true,
            jsdoc: true,
          },
          postBanner: bundleBanner,
        },
      },
    },
    build: {
      outDir,
      emptyOutDir: true,
      manifest: true,
      target: ['es2020', 'chrome111', 'edge111', 'firefox114', 'safari16'],
      modulePreload: {
        polyfill: false,
      },
      license: {
        fileName: 'licenses.txt',
      },
      rolldownOptions: {
        output: {
          comments: {
            legal: true,
            jsdoc: true,
          },
          postBanner: bundleBanner,
        },
      },
    },
  };
});
