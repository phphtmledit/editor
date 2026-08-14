import { defineConfig } from 'vite';
import { readFileSync } from 'node:fs';

const sourceUrl = 'https://github.com/phphtmledit/editor';
const noticesUrl = '/licenses.txt';
const bundleBanner = `/*! @license GPL-2.0-or-later
 * Source: ${sourceUrl}
 * Third-party notices: ${noticesUrl}
 */`;

export default defineConfig(({ mode }) => {
  const diagnostic = mode === 'e0';
  const diagnosticHtml = diagnostic
    ? readFileSync(new URL('./src/e0/index.html', import.meta.url), 'utf8')
    : '';

  return {
    plugins: diagnostic
      ? [
          {
            name: 'phphtmledit-e0-html',
            transformIndexHtml: {
              order: 'pre' as const,
              handler: () => diagnosticHtml,
            },
          },
        ]
      : [],
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
      outDir: diagnostic ? 'dist-e0' : 'dist',
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
