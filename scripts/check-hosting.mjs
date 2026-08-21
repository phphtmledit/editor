import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { isDeepStrictEqual } from 'node:util';
import { normalizeFrameAncestors } from './pages-headers.mjs';

const projectRoot = resolve(import.meta.dirname, '..');
const failures = [];
const baselineUrl = 'https://phphtmledit.com/';
const applicationHostname = 'app.phphtmledit.com';
const baselineRunCount = 5;
const expectedTooling = {
  lighthouse: '13.4.1',
  chrome: '151.0.7922.169',
  chromeUserAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/151.0.0.0 Safari/537.36',
  node: '24.19.0',
};
const expectedNetworkUserAgent = 'Mozilla/5.0 (Linux; Android 11; moto g power (2022)) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Mobile Safari/537.36';
const expectedEmulatedUserAgent = 'Mozilla/5.0 (Linux; Android 11; moto g power (2022)) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Mobile Safari/537.36';
const expectedSettings = {
  navigationMode: true,
  category: 'performance',
  formFactor: 'mobile',
  throttlingMethod: 'simulate',
  storageReset: true,
  locale: 'en-US',
  channel: 'cli',
  throttling: {
    rttMs: 150,
    throughputKbps: 1638.4,
    requestLatencyMs: 562.5,
    downloadThroughputKbps: 1474.5600000000002,
    uploadThroughputKbps: 675,
    cpuSlowdownMultiplier: 4,
  },
  screenEmulation: {
    mobile: true,
    width: 412,
    height: 823,
    deviceScaleFactor: 1.75,
    disabled: false,
  },
};

const reportMismatch = (label, actual, expected) => {
  if (!isDeepStrictEqual(actual, expected)) {
    failures.push(`${label} differs: expected ${JSON.stringify(expected)}, received ${JSON.stringify(actual)}`);
  }
};

const median = (values) => {
  const sorted = [...values].sort((left, right) => left - right);
  return sorted[Math.floor(sorted.length / 2)];
};

const countApplicationRequests = (requests) => requests.filter(({ url }) => {
  try {
    return new URL(url).hostname === applicationHostname;
  } catch {
    return false;
  }
}).length;

const settingsFromLhr = (lhr) => ({
  navigationMode: lhr.gatherMode === 'navigation',
  category: lhr.configSettings?.onlyCategories?.length === 1
    ? lhr.configSettings.onlyCategories[0]
    : null,
  formFactor: lhr.configSettings?.formFactor,
  throttlingMethod: lhr.configSettings?.throttlingMethod,
  storageReset: lhr.configSettings?.disableStorageReset === false,
  locale: lhr.configSettings?.locale,
  channel: lhr.configSettings?.channel,
  throttling: lhr.configSettings?.throttling,
  screenEmulation: lhr.configSettings?.screenEmulation,
});

const runFromLhr = (lhr, rawBytes, rawJsonSha256, run) => {
  const requests = lhr.audits?.['network-requests']?.details?.items ?? [];
  return {
    run,
    fetchTime: lhr.fetchTime,
    benchmarkIndex: lhr.environment?.benchmarkIndex,
    performanceScore: lhr.categories?.performance?.score * 100,
    firstContentfulPaintMs: lhr.audits?.['first-contentful-paint']?.numericValue,
    largestContentfulPaintMs: lhr.audits?.['largest-contentful-paint']?.numericValue,
    speedIndexMs: lhr.audits?.['speed-index']?.numericValue,
    totalBlockingTimeMs: lhr.audits?.['total-blocking-time']?.numericValue,
    cumulativeLayoutShift: lhr.audits?.['cumulative-layout-shift']?.numericValue,
    timeToInteractiveMs: lhr.audits?.interactive?.numericValue,
    maxPotentialFidMs: lhr.audits?.['max-potential-fid']?.numericValue,
    serverResponseTimeMs: lhr.audits?.['server-response-time']?.numericValue,
    requestCount: requests.length,
    transferBytes: lhr.audits?.['total-byte-weight']?.numericValue,
    resourceBytes: requests.reduce((total, request) => total + Number(request.resourceSize ?? 0), 0),
    applicationDomainRequests: countApplicationRequests(requests),
    runWarnings: lhr.runWarnings ?? [],
    lhrRuntimeError: lhr.runtimeError ?? null,
    rawJsonBytes: rawBytes.length,
    rawJsonSha256,
  };
};

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
  style="width:100%;height:clamp(520px, 90vh, 760px);border:0;display:block"
  title="HTML editor"
  loading="lazy"
  allow="clipboard-write"
></iframe>`;
  const iframeBlock = embedding
    .match(/```html\s*([\s\S]*?)```/i)?.[1]
    ?.trim()
    .replace(/\r\n?/g, '\n');
  if (iframeBlock !== expectedIframe) {
    failures.push('docs/EMBEDDING.md must contain the exact approved iframe contract');
  }
  if (!embedding.includes('Do **not** add `sandbox`') ||
      !/Do not add\r?\n`allow="fullscreen"`/.test(embedding)) {
    failures.push('docs/EMBEDDING.md must preserve the sandbox and fullscreen warnings');
  }

  const baseline = JSON.parse(baselineText);
  const rawFiles = baseline.rawArtifacts?.repositoryFiles;
  if (baseline.schemaVersion !== 2 || baseline.stage !== 'E5' ||
      baseline.scenario !== 'host-before-iframe' || baseline.url !== baselineUrl ||
      !Array.isArray(baseline.runs) || baseline.runs.length !== baselineRunCount ||
      !Array.isArray(rawFiles) || rawFiles.length !== baselineRunCount) {
    failures.push('The E5 pre-iframe Lighthouse summary has an invalid shape');
    return;
  }

  reportMismatch('E5 baseline tooling', baseline.tooling, expectedTooling);
  reportMismatch('E5 baseline profile', baseline.settings, expectedSettings);

  const hostState = baseline.hostState ?? {};
  for (const field of [
    'activeIframeCountBefore',
    'activeIframeCountAfter',
    'applicationDomainReferencesBefore',
    'applicationDomainReferencesAfter',
  ]) {
    if (hostState[field] !== 0) failures.push(`E5 host proof must record ${field} as zero`);
  }
  if (!Number.isInteger(hostState.htmlBytesBefore) || hostState.htmlBytesBefore <= 0 ||
      hostState.htmlBytesBefore !== hostState.htmlBytesAfter) {
    failures.push('E5 host proof must record the same non-zero HTML byte count before and after the runs');
  }

  const recomputedRuns = [];
  for (let index = 0; index < rawFiles.length; index += 1) {
    const expectedPath = `reports/lighthouse-host-baseline-e5-run-${index + 1}.json`;
    if (rawFiles[index] !== expectedPath) {
      failures.push(`Unexpected Lighthouse raw artifact path: ${rawFiles[index]}`);
      continue;
    }
    const bytes = await readFile(resolve(projectRoot, expectedPath));
    const hash = createHash('sha256').update(bytes).digest('hex');
    let lhr;
    try {
      lhr = JSON.parse(bytes.toString('utf8'));
    } catch (error) {
      failures.push(`Lighthouse raw artifact is not valid JSON (${expectedPath}): ${error instanceof Error ? error.message : String(error)}`);
      continue;
    }

    for (const urlField of ['requestedUrl', 'mainDocumentUrl', 'finalDisplayedUrl', 'finalUrl']) {
      if (lhr[urlField] !== baselineUrl) {
        failures.push(`${expectedPath} has an unexpected ${urlField}: ${JSON.stringify(lhr[urlField])}`);
      }
    }
    if (lhr.lighthouseVersion !== expectedTooling.lighthouse ||
        lhr.environment?.hostUserAgent !== expectedTooling.chromeUserAgent ||
        lhr.userAgent !== expectedTooling.chromeUserAgent ||
        lhr.environment?.networkUserAgent !== expectedNetworkUserAgent ||
        lhr.configSettings?.emulatedUserAgent !== expectedEmulatedUserAgent) {
      failures.push(`${expectedPath} was not captured with the canonical E5 tooling`);
    }
    reportMismatch(`${expectedPath} profile`, settingsFromLhr(lhr), expectedSettings);

    const recomputed = runFromLhr(lhr, bytes, hash, index + 1);
    recomputedRuns.push(recomputed);
    reportMismatch(`${expectedPath} summary metrics`, baseline.runs[index], recomputed);
    if (recomputed.runWarnings.length !== 0 || recomputed.lhrRuntimeError !== null) {
      failures.push(`${expectedPath} contains a Lighthouse warning or runtime error`);
    }
    if (recomputed.applicationDomainRequests !== 0) {
      failures.push(`${expectedPath} requested ${applicationHostname}`);
    }
  }

  if (recomputedRuns.length !== baselineRunCount) return;

  reportMismatch(
    'E5 host application-domain request proof',
    hostState.applicationDomainRequestsPerRun,
    recomputedRuns.map(({ applicationDomainRequests }) => applicationDomainRequests),
  );

  const firstFetchTime = Date.parse(recomputedRuns[0].fetchTime);
  const lastFetchTime = Date.parse(recomputedRuns.at(-1).fetchTime);
  const beforeProofTime = Date.parse(hostState.verifiedBeforeRunsAt);
  const afterProofTime = Date.parse(hostState.verifiedAfterRunsAt);
  if (!Number.isFinite(beforeProofTime) || !Number.isFinite(afterProofTime) ||
      beforeProofTime > firstFetchTime || afterProofTime < lastFetchTime) {
    failures.push('E5 host proof timestamps do not bracket the five Lighthouse runs');
  }

  const recomputedMedian = {
    performanceScoreReference: median(recomputedRuns.map(({ performanceScore }) => performanceScore)),
    firstContentfulPaintMs: median(recomputedRuns.map(({ firstContentfulPaintMs }) => firstContentfulPaintMs)),
    largestContentfulPaintMs: median(recomputedRuns.map(({ largestContentfulPaintMs }) => largestContentfulPaintMs)),
    speedIndexMs: median(recomputedRuns.map(({ speedIndexMs }) => speedIndexMs)),
    totalBlockingTimeMs: median(recomputedRuns.map(({ totalBlockingTimeMs }) => totalBlockingTimeMs)),
    cumulativeLayoutShift: median(recomputedRuns.map(({ cumulativeLayoutShift }) => cumulativeLayoutShift)),
  };
  reportMismatch('E5 five-run Lighthouse medians', baseline.median, recomputedMedian);
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
