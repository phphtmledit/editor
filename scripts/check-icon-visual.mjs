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
const paletteReport = JSON.parse(
  await readFile(resolve(projectRoot, 'reports', 'e5-palette-visual.json'), 'utf8'),
);
const indexHtml = await readFile(resolve(projectRoot, 'index.html'), 'utf8');
const iconBytes = await readFile(resolve(projectRoot, 'public', 'tinymce', CUSTOM_ICON_ASSET));
const failures = [];

const shellActionIcons = [
  { buttonId: 'choose-import-file', icon: 'folder-open', copyKey: 'openFile' },
  { buttonId: 'export-html', icon: 'download', copyKey: 'downloadHtml' },
  { buttonId: 'copy-html', icon: 'copy-code', copyKey: 'copyHtml' },
  { buttonId: 'copy-text', icon: 'copy-text', copyKey: 'copyText' },
  { buttonId: 'load-example', icon: 'sparkles', copyKey: 'loadExample' },
  { buttonId: 'new-document', icon: 'file-plus', copyKey: 'newDocument' },
];

for (const { buttonId, icon, copyKey } of shellActionIcons) {
  const body = indexHtml.match(
    new RegExp(`<button\\b[^>]*\\bid="${buttonId}"[^>]*>([\\s\\S]*?)<\\/button>`),
  )?.[1] ?? '';
  const svgTags = body.match(/<svg\b[^>]*>/g) ?? [];
  const svg = svgTags[0] ?? '';
  if (svgTags.length !== 1 ||
      !/class="io-action-icon"/.test(svg) ||
      !svg.includes(`data-icon="${icon}"`) ||
      !/viewBox="0 0 24 24"/.test(svg) ||
      !/aria-hidden="true"/.test(svg) ||
      !/focusable="false"/.test(svg) ||
      /<title\b|\brole=|\btabindex=/i.test(body) ||
      !body.includes(`<span class="io-action-label">{{phe:${copyKey}}}</span>`)) {
    failures.push(`Shell action ${buttonId} does not have the exact accessible ${icon} icon contract`);
  }
}

if (CUSTOM_ICON_NAMES.includes('temporary-placeholder')) {
  failures.push('temporary-placeholder must stay absent so missing icons are detectable');
}

const requiredScenarios = [
  'toolbar including overflow',
  'File/Edit/View/Insert/Format/Table/About menus',
  'text color palette and color picker',
  'link dialog and link context actions',
  'image dialog with lock and unlock states',
  'table picker and inserted-table context menu',
  'Table properties General and Advanced tabs',
  'Row/Column/Cell nested table menus',
  'character map dialog',
  'emoji dialog with 300-entry common database',
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
  aboutItemsHaveNoIconSlots: true,
};
for (const [name, expected] of Object.entries(expectedAssertions)) {
  if (report.assertions?.[name] !== expected) {
    failures.push(`Visual assertion ${name} must be ${JSON.stringify(expected)}`);
  }
}

const e5Extension = report.extensions?.find(({ stage }) => stage === 'E5');
if (
  e5Extension?.shellActionIconCount !== shellActionIcons.length ||
  JSON.stringify(e5Extension?.shellActionIcons) !== JSON.stringify(
    shellActionIcons.map(({ buttonId, icon }) => ({ buttonId, icon })),
  ) ||
  e5Extension?.shellActionIconEvidence !== 'tests/ui/action-icons.test.ts'
) {
  failures.push('The E5 extension must bind the six project-authored shell action icons');
}
const e5ScreenshotContracts = [
  ['aboutMenuScreenshot', 'aboutMenuScreenshotSha256', 'reports/e5-about-menu.png'],
  ['linkDialogScreenshot', 'linkDialogScreenshotSha256', 'reports/e5-link-dialog.png'],
];
for (const [pathField, hashField, expectedPath] of e5ScreenshotContracts) {
  if (e5Extension?.[pathField] !== expectedPath) {
    failures.push(`E5 visual evidence path ${pathField} must be ${expectedPath}`);
    continue;
  }
  const evidenceBytes = await readFile(resolve(projectRoot, expectedPath));
  const evidenceHash = createHash('sha256').update(evidenceBytes).digest('hex');
  if (e5Extension?.[hashField] !== evidenceHash) {
    failures.push(`E5 visual evidence hash differs for ${expectedPath}`);
  }
}

if (
  paletteReport.stage !== 'E5' ||
  paletteReport.tokens?.accent !== '#0B6BCB' ||
  paletteReport.tokens?.accentSoft !== '#E6F1FB' ||
  paletteReport.computedStates?.nativeWrapAccentColor !== 'rgb(11, 107, 203)' ||
  paletteReport.computedStates?.tinyDialogFocusedFieldBorder !== 'rgb(11, 107, 203)' ||
  paletteReport.computedStates?.tinyDialogPrimaryBackground !== 'rgb(11, 107, 203)' ||
  paletteReport.computedStates?.tinyAboutActiveBackground !== 'rgb(230, 241, 251)' ||
  paletteReport.computedStates?.tinyAboutActiveText !== 'rgb(23, 32, 51)' ||
  paletteReport.contrast?.minimumRatio !== 4.914 ||
  paletteReport.contrast?.minimumPair !== 'muted text on accent-soft' ||
  paletteReport.contrast?.threshold !== 4.5 ||
  paletteReport.contrast?.passed !== true ||
  paletteReport.result !== 'PASS' ||
  Object.values(paletteReport.assertions ?? {}).some((value) => value !== true) ||
  JSON.stringify(paletteReport.screenshots) !== JSON.stringify(
    e5ScreenshotContracts.map(([pathField, hashField]) => ({
      path: e5Extension?.[pathField],
      sha256: e5Extension?.[hashField],
    })),
  )
) {
  failures.push('The E5 palette evidence is missing, stale, or inconsistent with its gated screenshots');
}

if (failures.length > 0) {
  console.error(failures.join('\n'));
  process.exitCode = 1;
} else {
  console.log(
    `Visual icon evidence verified for ${requiredScenarios.length} UI scenarios and ` +
      `${CUSTOM_ICON_NAMES.length} configured TinyMCE icons plus ${shellActionIcons.length} shell action icons.`,
  );
}
