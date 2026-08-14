/*! @license GPL-2.0-or-later | https://github.com/phphtmledit/editor */
import { resolve } from 'node:path';

export const mammothBrowserAliases = (projectRoot) => [
  {
    find: /^bluebird\/js\/release\/promise$/,
    replacement: resolve(projectRoot, 'src/vendor/mammoth/native-bluebird.cjs'),
  },
  {
    find: /^xmlbuilder$/,
    replacement: resolve(projectRoot, 'src/vendor/mammoth/xmlbuilder-stub.cjs'),
  },
  {
    find: /^underscore$/,
    replacement: resolve(projectRoot, 'src/vendor/mammoth/underscore-facade.js'),
  },
];
