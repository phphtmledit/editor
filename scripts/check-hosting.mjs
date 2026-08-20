import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { normalizeFrameAncestors } from './pages-headers.mjs';

const projectRoot = resolve(import.meta.dirname, '..');
const failures = [];

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

await Promise.all([
  verifyArtifact('production', resolve(projectRoot, 'dist')),
  verifyArtifact('diagnostic', resolve(projectRoot, 'dist-e0')),
]);

console.log(JSON.stringify({
  artifacts: ['dist/_headers', 'dist-e0/_headers'],
  failures,
}, null, 2));
if (failures.length > 0) process.exitCode = 1;
