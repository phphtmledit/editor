/*! @license GPL-2.0-or-later | https://github.com/phphtmledit/editor */
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'jsdom',
    include: ['tests/**/*.test.ts'],
  },
});
