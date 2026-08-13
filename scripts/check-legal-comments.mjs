import { readFile, readdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { resolve } from 'node:path';
import {
  CUSTOM_ICON_ASSET,
  CUSTOM_ICON_MODIFIED_DATE,
  CUSTOM_ICON_NAMES,
  CUSTOM_ICON_PACK,
  TINYMCE_VENDOR_ASSETS,
  TINYMCE_VERSION,
} from './tinymce-assets.mjs';

const projectRoot = resolve(import.meta.dirname, '..');
const failures = [];

const requireMatch = (text, expression, message) => {
  if (!expression.test(text)) failures.push(message);
};

const builtLicense = await readFile(resolve(projectRoot, 'dist', 'licenses.txt'), 'utf8');
requireMatch(builtLicense, /BSD 2-Clause|BSD-2-Clause|Michael Williamson/i, 'Mammoth license is absent from dist/licenses.txt');

const mainJsPath = (await readdir(resolve(projectRoot, 'dist', 'assets')))
  .find((file) => file.endsWith('.js') && file.startsWith('index-'));
if (!mainJsPath) failures.push('Built application JS was not found');
else {
  const mainJs = await readFile(resolve(projectRoot, 'dist', 'assets', mainJsPath), 'utf8');
  requireMatch(mainJs, /@license GPL-2\.0-or-later/, 'Project GPL legal comment did not survive minification');
  requireMatch(mainJs, /Third-party notices: \/licenses\.txt/, 'Project bundle has no canonical notices URL');
}

for (const asset of TINYMCE_VENDOR_ASSETS) {
  const [source, built] = await Promise.all([
    readFile(resolve(projectRoot, 'node_modules', 'tinymce', asset)),
    readFile(resolve(projectRoot, 'dist', 'tinymce', asset)),
  ]);
  const sourceHash = createHash('sha256').update(source).digest('hex');
  const builtHash = createHash('sha256').update(built).digest('hex');
  if (sourceHash !== builtHash) failures.push(`TinyMCE asset changed during build: ${asset}`);
}

const [publicCustomIcons, builtCustomIcons] = await Promise.all([
  readFile(resolve(projectRoot, 'public', 'tinymce', CUSTOM_ICON_ASSET)),
  readFile(resolve(projectRoot, 'dist', 'tinymce', CUSTOM_ICON_ASSET)),
]);
if (
  createHash('sha256').update(publicCustomIcons).digest('hex') !==
  createHash('sha256').update(builtCustomIcons).digest('hex')
) {
  failures.push(`Generated custom icon asset changed during build: ${CUSTOM_ICON_ASSET}`);
}
const customIconText = publicCustomIcons.toString('utf8');
const customIconCopyright =
  'Copyright (c) 2025 Ephox Corporation DBA Tiny Technologies, Inc.';
const customIconLicense =
  '@license GPL-2.0-or-later — full text in tinymce/license.md';
const customIconDerivation =
  `Derived from the TinyMCE ${TINYMCE_VERSION} default icon pack.`;
const customIconModification =
  `Modified by the phphtmledit project on ${CUSTOM_ICON_MODIFIED_DATE}: ` +
  `selected a ${CUSTOM_ICON_NAMES.length}-icon\n` +
  ' * subset and changed the pack registration name. Icon artwork is unaltered.';
const expectedCustomIconBanner =
  `/*!\n` +
  ` * ${customIconCopyright}\n` +
  ` * ${customIconLicense}\n` +
  ` *\n` +
  ` * ${customIconDerivation}\n` +
  ` * ${customIconModification}\n` +
  ` */`;

requireMatch(
  customIconText,
  /Copyright \(c\) 2025 Ephox Corporation DBA Tiny Technologies, Inc\./,
  'Custom icon TinyMCE copyright notice is missing',
);
requireMatch(
  customIconText,
  /@license GPL-2\.0-or-later — full text in tinymce\/license\.md/,
  'Custom icon GPL legal comment is missing',
);
if (!customIconText.includes(customIconModification)) {
  failures.push('Custom icon exact dated modification notice is missing');
}
if (!customIconText.startsWith(`${expectedCustomIconBanner}\n`)) {
  failures.push('Custom icon legal banner wording or notice order differs');
}
requireMatch(
  customIconText,
  new RegExp(`IconManager\\.add\\(${JSON.stringify(CUSTOM_ICON_PACK)}`),
  'Custom icon pack registration is missing',
);
const customIconEntryCount = (customIconText.match(/<svg\b/g) ?? []).length;
if (customIconEntryCount !== CUSTOM_ICON_NAMES.length) {
  failures.push(
    `Custom icon count differs: expected ${CUSTOM_ICON_NAMES.length}, got ${customIconEntryCount}`,
  );
}

const tinyCore = await readFile(resolve(projectRoot, 'dist', 'tinymce', 'tinymce.min.js'), 'utf8');
requireMatch(tinyCore, new RegExp(`TinyMCE version ${TINYMCE_VERSION.replaceAll('.', '\\.')}`), 'TinyMCE version header is missing');
requireMatch(tinyCore, /@license DOMPurify 3\.4\.12/, 'Embedded DOMPurify 3.4.12 legal comment is missing');
requireMatch(tinyCore, /Mozilla Public License 2\.0/, 'Embedded DOMPurify MPL-2.0 choice is missing');

const skinCss = await readFile(resolve(projectRoot, 'dist', 'tinymce', 'skins', 'ui', 'oxide', 'content.min.css'), 'utf8');
requireMatch(skinCss, /PrismJS|prismjs/i, 'PrismJS notice is missing from TinyMCE skin CSS');

if (failures.length > 0) {
  console.error(failures.join('\n'));
  process.exitCode = 1;
} else {
  console.log(
    `Legal comments, ${TINYMCE_VENDOR_ASSETS.length} byte-identical TinyMCE assets, ` +
      `and the ${CUSTOM_ICON_NAMES.length}-icon custom pack verified.`,
  );
}
