import { defineConfig } from 'vite';

const sourceUrl = 'https://github.com/phphtmledit/editor';
const noticesUrl = '/licenses.txt';
const bundleBanner = `/*! @license GPL-2.0-or-later
 * Source: ${sourceUrl}
 * Third-party notices: ${noticesUrl}
 */`;

export default defineConfig(({ mode }) => {
  const diagnostic = mode === 'e0';

  return {
    define: {
      __E0_DIAGNOSTIC__: JSON.stringify(diagnostic),
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
