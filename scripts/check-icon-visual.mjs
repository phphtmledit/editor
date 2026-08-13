import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import {
  CUSTOM_ICON_ASSET,
  CUSTOM_ICON_NAMES,
  CUSTOM_ICON_PACK,
  TINYMCE_VERSION,
} from './tinymce-assets.mjs';

const projectRoot = resolve(import.meta.dirname, '..');
const report = JSON.parse(
  await readFile(resolve(projectRoot, 'reports', 'icon-visual-result.json'), 'utf8'),
);
const iconBytes = await readFile(resolve(projectRoot, 'public', 'tinymce', CUSTOM_ICON_ASSET));
const failures = [];

if (CUSTOM_ICON_NAMES.includes('temporary-placeholder')) {
  failures.push('temporary-placeholder must stay absent so missing icons are detectable');
}

const requiredScenarios = [
  'toolbar including overflow',
  'File/Edit/View/Insert/Format/Table menus',
  'text color palette and color picker',
  'link dialog and link context actions',
  'image dialog with lock and unlock states',
  'table picker and inserted-table context menu',
  'Table properties General and Advanced tabs',
  'Row/Column/Cell nested table menus',
  'character map dialog',
  'emoji dialog with full unchanged database',
  'date/time menu',
];

if (report.pack !== CUSTOM_ICON_PACK) failures.push(`Unexpected icon pack: ${report.pack}`);
if (report.tinyMceVersion !== TINYMCE_VERSION) {
  failures.push(`Unexpected TinyMCE version: ${report.tinyMceVersion}`);
}
if (report.configuredIcons !== CUSTOM_ICON_NAMES.length) {
  failures.push(
    `Configured icon count differs: expected ${CUSTOM_ICON_NAMES.length}, got ${report.configuredIcons}`,
  );
}
const currentHash = createHash('sha256').update(iconBytes).digest('hex');
if (report.customIconSha256 !== currentHash) {
  failures.push('Visual report does not match the current generated custom icon asset');
}
for (const scenario of requiredScenarios) {
  if (!report.scenarios?.includes(scenario)) failures.push(`Visual scenario is missing: ${scenario}`);
}

const expectedAssertions = {
  allObservedToxIconsContainSvg: true,
  temporaryPlaceholderAvailable: false,
  temporaryPlaceholderRendered: false,
  notFoundFallbackRendered: false,
  stockDefaultIconRequestObserved: false,
  customIconColdRequests: 1,
  consoleWarningsOrErrors: 0,
};
for (const [name, expected] of Object.entries(expectedAssertions)) {
  if (report.assertions?.[name] !== expected) {
    failures.push(`Visual assertion ${name} must be ${JSON.stringify(expected)}`);
  }
}

if (failures.length > 0) {
  console.error(failures.join('\n'));
  process.exitCode = 1;
} else {
  console.log(
    `Visual icon evidence verified for ${requiredScenarios.length} UI scenarios and ` +
      `${CUSTOM_ICON_NAMES.length} configured icons.`,
  );
}
