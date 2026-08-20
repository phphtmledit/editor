import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { normalizeFrameAncestors } from './pages-headers.mjs';

const projectRoot = resolve(import.meta.dirname, '..');
const failures = [];

const verifyDocumentationAndBaseline = async () => {
  const [readme, embedding, baselineText] = await Promise.all([
    readFile(resolve(projectRoot, 'README.md'), 'utf8'),
    readFile(resolve(projectRoot, 'docs', 'EMBEDDING.md'), 'utf8'),
    readFile(resolve(projectRoot, 'reports', 'lighthouse-host-baseline-e5.json'), 'utf8'),
  ]);
  if (/\p{Script=Cyrillic}/u.test(`${readme}\n${embedding}`)) {
    failures.push('README.md and docs/EMBEDDING.md must remain English');
  }
  for (const required of [
    'GPL-2.0-or-later',
    'TinyMCE, © Tiny Technologies, Inc.',
    'https://github.com/phphtmledit/editor',
    'docs/EMBEDDING.md',
  ]) {
    if (!readme.includes(required)) failures.push(`README.md is missing: ${required}`);
  }

  const expectedIframe = `<iframe
  src="https://app.phphtmledit.com/?theme=auto"
  style="width:100%;height:760px;border:0;display:block"
  title="HTML editor"
  loading="lazy"
  allow="clipboard-write"
></iframe>`;
  const iframeBlock = embedding.match(/```html\s*([\s\S]*?)```/i)?.[1]?.trim();
  if (iframeBlock !== expectedIframe) {
    failures.push('docs/EMBEDDING.md must contain the exact approved iframe contract');
  }
  if (!embedding.includes('Do **not** add `sandbox`') ||
      !/Do not add\r?\n`allow="fullscreen"`/.test(embedding)) {
    failures.push('docs/EMBEDDING.md must preserve the sandbox and fullscreen warnings');
  }

  const baseline = JSON.parse(baselineText);
  const rawFiles = baseline.rawArtifacts?.repositoryFiles;
  if (baseline.stage !== 'E5' || baseline.scenario !== 'host-before-iframe' ||
      !Array.isArray(baseline.runs) || baseline.runs.length !== 3 ||
      !Array.isArray(rawFiles) || rawFiles.length !== 3) {
    failures.push('The E5 pre-iframe Lighthouse summary has an invalid shape');
    return;
  }
  for (let index = 0; index < rawFiles.length; index += 1) {
    const expectedPath = `reports/lighthouse-host-baseline-e5-run-${index + 1}.json`;
    if (rawFiles[index] !== expectedPath) {
      failures.push(`Unexpected Lighthouse raw artifact path: ${rawFiles[index]}`);
      continue;
    }
    const bytes = await readFile(resolve(projectRoot, expectedPath));
    const hash = createHash('sha256').update(bytes).digest('hex');
    if (baseline.runs[index]?.rawJsonSha256 !== hash) {
      failures.push(`Lighthouse raw artifact hash differs: ${expectedPath}`);
    }
  }
};

const verifyArtifact = async (name, root) => {
  const path = resolve(root, '_headers');
  let contents = '';
  try {
    contents = await readFile(path, 'utf8');
  } catch (error) {
    failures.push(`${name} is missing _headers: ${error instanceof Error ? error.message : String(error)}`);
    return;
  }

  if (!/\/\*\s*\n\s+X-Robots-Tag:\s*noindex, nofollow\s*$/m.test(contents)) {
    failures.push(`${name} _headers is missing the exact X-Robots-Tag policy`);
  }

  const csp = contents.match(/^\s*Content-Security-Policy:\s*frame-ancestors\s+(.+)$/m)?.[1]?.trim();
  if (!csp) {
    failures.push(`${name} _headers is missing the frame-ancestors CSP`);
  } else {
    try {
      normalizeFrameAncestors(csp);
    } catch (error) {
      failures.push(`${name} _headers has an invalid frame-ancestors CSP: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  if (!/\/assets\/\*\s*\n\s+Cache-Control:\s*public, max-age=31536000, immutable\s*$/m.test(contents)) {
    failures.push(`${name} _headers is missing immutable caching for hashed assets`);
  }
  if (!/\/licenses\.txt\s*\n\s+Content-Type:\s*text\/plain; charset=utf-8\s*$/m.test(contents)) {
    failures.push(`${name} _headers is missing the notices MIME override`);
  }
  if (/X-Frame-Options/i.test(contents)) {
    failures.push(`${name} _headers must not add X-Frame-Options beside the CSP allow-list`);
  }
  if (/phe-preview\.com/i.test(contents)) {
    failures.push(`${name} _headers must exclude phe-preview.com`);
  }

  const immutableRules = [...contents.matchAll(/(^\S.*)\r?\n\s+Cache-Control:\s*public, max-age=31536000, immutable\s*$/gm)]
    .map((match) => match[1]);
  if (JSON.stringify(immutableRules) !== JSON.stringify(['/assets/*'])) {
    failures.push(`${name} immutable cache scope differs: ${JSON.stringify(immutableRules)}`);
  }
};

const artifacts = [
  ['production', resolve(projectRoot, 'dist'), 'dist/_headers'],
];
if (process.argv.includes('--include-diagnostic')) {
  artifacts.push(['diagnostic', resolve(projectRoot, 'dist-e0'), 'dist-e0/_headers']);
}

await Promise.all([
  ...artifacts.map(([name, root]) => verifyArtifact(name, root)),
  verifyDocumentationAndBaseline(),
]);

console.log(JSON.stringify({
  artifacts: artifacts.map(([, , path]) => path),
  failures,
}, null, 2));
if (failures.length > 0) process.exitCode = 1;
