import { copyFile, mkdir, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { dirname, isAbsolute, join, relative, resolve } from 'node:path';
import { runInNewContext } from 'node:vm';
import {
  CUSTOM_ICON_ASSET,
  CUSTOM_ICON_MODIFIED_DATE,
  CUSTOM_ICON_NAMES,
  CUSTOM_ICON_PACK,
  TINYMCE_VENDOR_ASSETS,
  TINYMCE_VERSION,
} from './tinymce-assets.mjs';

const projectRoot = resolve(import.meta.dirname, '..');
const sourceRoot = resolve(projectRoot, 'node_modules', 'tinymce');
const targetRoot = resolve(projectRoot, 'public', 'tinymce');

const assertInside = (parent, child) => {
  const pathFromParent = relative(parent, child);
  if (pathFromParent.startsWith('..') || isAbsolute(pathFromParent)) {
    throw new Error(`Unsafe path outside ${parent}: ${child}`);
  }
};

assertInside(projectRoot, sourceRoot);
assertInside(projectRoot, targetRoot);

const packageJson = JSON.parse(await readFile(join(sourceRoot, 'package.json'), 'utf8'));
if (packageJson.version !== TINYMCE_VERSION) {
  throw new Error(`Expected TinyMCE ${TINYMCE_VERSION}, found ${packageJson.version}`);
}

await stat(sourceRoot);
await rm(targetRoot, { recursive: true, force: true });

const manifest = [];
for (const asset of TINYMCE_VENDOR_ASSETS) {
  const source = resolve(sourceRoot, asset);
  const target = resolve(targetRoot, asset);
  assertInside(sourceRoot, source);
  assertInside(targetRoot, target);
  await stat(source);
  await mkdir(dirname(target), { recursive: true });
  await copyFile(source, target);

  const [sourceBytes, targetBytes] = await Promise.all([readFile(source), readFile(target)]);
  const sourceHash = createHash('sha256').update(sourceBytes).digest('hex');
  const targetHash = createHash('sha256').update(targetBytes).digest('hex');
  if (sourceHash !== targetHash) throw new Error(`Copy verification failed for ${asset}`);
  manifest.push({
    path: asset,
    kind: 'vendor-byte-identical',
    bytes: targetBytes.byteLength,
    sha256: targetHash,
  });
}

let defaultIconPack;
runInNewContext(
  await readFile(resolve(sourceRoot, 'icons/default/icons.js'), 'utf8'),
  {
    tinymce: {
      IconManager: {
        add: (name, iconPack) => {
          if (name === 'default') defaultIconPack = iconPack;
        },
      },
    },
  },
  { filename: 'tinymce/icons/default/icons.js' },
);
if (!defaultIconPack?.icons) throw new Error('Could not read the TinyMCE default icon pack');

const selectedIcons = {};
for (const name of CUSTOM_ICON_NAMES) {
  const svg = defaultIconPack.icons[name];
  if (typeof svg !== 'string') throw new Error(`TinyMCE default icon is missing: ${name}`);
  selectedIcons[name] = svg;
}
const customIconBanner =
  `/*!\n` +
  ` * Copyright (c) 2025 Ephox Corporation DBA Tiny Technologies, Inc.\n` +
  ` * @license GPL-2.0-or-later — full text in tinymce/license.md\n` +
  ` *\n` +
  ` * Derived from the TinyMCE ${TINYMCE_VERSION} default icon pack.\n` +
  ` * Modified by the phphtmledit project on ${CUSTOM_ICON_MODIFIED_DATE}: selected a ${CUSTOM_ICON_NAMES.length}-icon\n` +
  ` * subset and changed the pack registration name. Icon artwork is unaltered.\n` +
  ` */`;
const customIconSource =
  `${customIconBanner}\n` +
  `tinymce.IconManager.add(${JSON.stringify(CUSTOM_ICON_PACK)},` +
  `${JSON.stringify({ icons: selectedIcons })});\n`;
const customTarget = resolve(targetRoot, CUSTOM_ICON_ASSET);
assertInside(targetRoot, customTarget);
await mkdir(dirname(customTarget), { recursive: true });
await writeFile(customTarget, customIconSource, 'utf8');
const customBytes = await readFile(customTarget);
manifest.push({
  path: CUSTOM_ICON_ASSET,
  kind: 'project-generated-from-tinymce',
  icons: CUSTOM_ICON_NAMES.length,
  bytes: customBytes.byteLength,
  sha256: createHash('sha256').update(customBytes).digest('hex'),
});

await mkdir(resolve(projectRoot, 'reports'), { recursive: true });
await writeFile(
  resolve(projectRoot, 'reports', 'tinymce-assets.json'),
  `${JSON.stringify({ version: TINYMCE_VERSION, assets: manifest }, null, 2)}\n`,
  'utf8',
);

console.log(
  `Copied and verified ${TINYMCE_VENDOR_ASSETS.length} TinyMCE ${TINYMCE_VERSION} files; ` +
    `generated ${CUSTOM_ICON_PACK} with ${CUSTOM_ICON_NAMES.length} icons.`,
);
