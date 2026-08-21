import { createHash } from 'node:crypto';
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, relative, resolve, sep } from 'node:path';
import { isDeepStrictEqual } from 'node:util';

const PACKAGE_RELATIVE_PATH = 'reports/host-position-e5';
const EXPECTED_MANIFEST_SHA256 = '1b3fbaf63f8d08e6f20ed9075a6b75332898a6bc53824637937f4c5e64cb5a13';
const EXPECTED_SUMMARY_SHA256 = '950725c9a933c9c46fe13a2b6e2c54af4d20f003851eb8b04a3cb5967c451aad';
const EXPECTED_HOST_SOURCE = {
  bytes: 21846,
  sha256: '52bd72ef0d57ddff19b387c63c479eeae1ac1ad498afb85468870e9cd42ae048',
};
const EXPECTED_PROFILE = {
  channel: 'cli',
  formFactor: 'mobile',
  locale: 'en-US',
  onlyCategories: ['performance'],
  output: ['json'],
  screenEmulation: {
    deviceScaleFactor: 1.75,
    disabled: false,
    height: 823,
    mobile: true,
    width: 412,
  },
  throttling: {
    cpuSlowdownMultiplier: 4,
    downloadThroughputKbps: 1474.5600000000002,
    requestLatencyMs: 562.5,
    rttMs: 150,
    throughputKbps: 1638.4,
    uploadThroughputKbps: 675,
  },
  throttlingMethod: 'simulate',
};
const EXPECTED_CHROME_FLAGS = [
  '--headless=new',
  '--disable-gpu',
  '--force-effective-connection-type=4G',
];
const EXPECTED_SCHEDULE = [
  ['control', 'below-fold', 'three-viewports-down'],
  ['below-fold', 'three-viewports-down', 'control'],
  ['three-viewports-down', 'control', 'below-fold'],
  ['control', 'below-fold', 'three-viewports-down'],
  ['below-fold', 'three-viewports-down', 'control'],
];
const EXPECTED_VARIANTS = {
  control: {
    marginPx: 0,
    finalRect: { top: 531.53125, bottom: 1272.21875, left: 16, right: 396, width: 380, height: 740.6875 },
    finalDistanceBelowFoldPx: 0,
    foldClass: 'crosses-first-fold',
    appProgress: [18, 18, 18, 18, 18],
    scores: [89, 89, 87, 88, 89],
    metrics: {
      fcpMs: [1675.5010000000002, 1662.9624000000001, 1959.8955, 1710.0496000000003, 2052.0125],
      lcpMs: [1675.5010000000002, 1662.9624000000001, 1959.8955, 1710.0496000000003, 2052.0125],
      speedIndexMs: [2532.5947224226475, 2265.992092750903, 3325.733352541226, 3048.9065594974777, 2948.7910992342104],
      tbtMs: [394, 412, 417.5, 409.5, 349.5],
      cls: [0, 0, 0, 0, 0],
    },
  },
  'below-fold': {
    marginPx: 617.25,
    finalRect: { top: 1148.78125, bottom: 1889.46875, left: 16, right: 396, width: 380, height: 740.6875 },
    finalDistanceBelowFoldPx: 325.78125,
    foldClass: 'below-first-viewport',
    appProgress: [4, 18, 4, 4, 4],
    scores: [99, 75, 96, 98, 99],
    metrics: {
      fcpMs: [1690.589, 3307.188, 1969.7689999999998, 1960.6250000000002, 1732.3413799999998],
      lcpMs: [1690.589, 3307.188, 1969.7689999999998, 1960.6250000000002, 1732.3413799999998],
      speedIndexMs: [1883.2116082703415, 4814.632058636975, 3901.5113617220013, 2452.966938016504, 2173.7880118617304],
      tbtMs: [0, 359, 0, 0, 0],
      cls: [0, 0, 0, 0, 0],
    },
  },
  'three-viewports-down': {
    marginPx: 2469,
    finalRect: { top: 3000.53125, bottom: 3741.21875, left: 16, right: 396, width: 380, height: 740.6875 },
    finalDistanceBelowFoldPx: 2177.53125,
    foldClass: 'below-first-viewport',
    appProgress: [4, 4, 4, 4, 4],
    scores: [99, 99, 98, 98, 99],
    metrics: {
      fcpMs: [1687.0955, 1705.8514999999998, 1818.6814999999997, 1836.3531000000003, 1654.8564999999999],
      lcpMs: [1687.0955, 1705.8514999999998, 1818.6814999999997, 1836.3531000000003, 1654.8564999999999],
      speedIndexMs: [1990.2850469203213, 1917.1399365061661, 2325.9305467907334, 2132.7499611390704, 1736.392496104073],
      tbtMs: [0, 0, 0, 0, 0],
      cls: [0, 0, 0, 0, 0],
    },
  },
};
const METRIC_AUDITS = {
  fcpMs: 'first-contentful-paint',
  lcpMs: 'largest-contentful-paint',
  speedIndexMs: 'speed-index',
  tbtMs: 'total-blocking-time',
  cls: 'cumulative-layout-shift',
};
const RECT_FIELDS = ['top', 'bottom', 'left', 'right', 'width', 'height'];
const GEOMETRY_LABELS = [
  'first-seen',
  'dom-content-loaded',
  'window-load',
  'after-first-contentful-paint',
  'final',
];
const CONNECTION_LABELS = [
  'document-start',
  'dom-content-loaded',
  'window-load',
  'after-first-contentful-paint',
  'final',
];
const PAINT_SHELL_INVENTORY = [
  { url: 'https://app.phphtmledit.com/?theme=auto', method: 'GET', resourceType: 'Document', status: 200 },
  { url: 'https://app.phphtmledit.com/tinymce/tinymce.min.js?v=8.8.2', method: 'GET', resourceType: 'Script', status: 200 },
  { url: 'https://app.phphtmledit.com/assets/index-6_wYmLrV.js', method: 'GET', resourceType: 'Script', status: 200 },
  { url: 'https://app.phphtmledit.com/assets/index-BX4V7LXB.css', method: 'GET', resourceType: 'Stylesheet', status: 200 },
];

const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex');
const posix = (path) => path.split(sep).join('/');
const stats = (values) => {
  const sorted = [...values].sort((left, right) => left - right);
  const minimum = sorted[0];
  const maximum = sorted.at(-1);
  return {
    maximum,
    median: sorted[Math.floor(sorted.length / 2)],
    minimum,
    range: maximum - minimum,
    values,
  };
};

const listFiles = (root) => {
  const output = [];
  const visit = (directory) => {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      const absolute = join(directory, entry.name);
      if (entry.isDirectory()) visit(absolute);
      else if (entry.isFile()) output.push(posix(relative(root, absolute)));
      else throw new Error(`Unsupported package entry: ${absolute}`);
    }
  };
  visit(root);
  return output.sort((left, right) => left.localeCompare(right, 'en'));
};

const profileFromLhr = (lhr) => ({
  channel: lhr.configSettings?.channel,
  formFactor: lhr.configSettings?.formFactor,
  locale: lhr.configSettings?.locale,
  onlyCategories: lhr.configSettings?.onlyCategories,
  output: lhr.configSettings?.output,
  screenEmulation: lhr.configSettings?.screenEmulation,
  throttling: lhr.configSettings?.throttling,
  throttlingMethod: lhr.configSettings?.throttlingMethod,
});

const metricsFromLhr = (lhr) => Object.fromEntries(
  Object.entries(METRIC_AUDITS).map(([name, audit]) => [name, lhr.audits?.[audit]?.numericValue]),
);

const rectEquals = (left, right) => RECT_FIELDS.every((field) => left?.[field] === right?.[field]);
const rectWithTop = (top) => ({
  top,
  bottom: top + 740.6875,
  left: top === 359.875 || top === 977.125 || top === 2828.875 ? 8 : 16,
  right: top === 359.875 || top === 977.125 || top === 2828.875 ? 404 : 396,
  width: top === 359.875 || top === 977.125 || top === 2828.875 ? 396 : 380,
  height: 740.6875,
});

const findUnsafePortableValue = (value, path = '$') => {
  if (typeof value === 'string') {
    if (
      /(?:^|[\s"'=])[a-z]:[\\/]|\\\\\?\\|file:\/\/\/(?:Users|home|[a-z]:)|(?:^|[\s"'])work[\\/]|AppData|\.codex|\.npm-cache|cfut_|\bBearer\b/iu.test(value)
    ) return `${path}: ${value}`;
    return null;
  }
  if (Array.isArray(value)) {
    for (let index = 0; index < value.length; index += 1) {
      const unsafe = findUnsafePortableValue(value[index], `${path}[${index}]`);
      if (unsafe) return unsafe;
    }
    return null;
  }
  if (value && typeof value === 'object') {
    for (const [key, child] of Object.entries(value)) {
      if (/^(authorization|cookie|set-cookie)$/iu.test(key)) return `${path}.${key}`;
      if (key === 'pid' && typeof child === 'number') return `${path}.${key}: numeric OS PID`;
      if (key === 'stack' && child !== '<redacted-stack>') return `${path}.${key}: unredacted stack`;
      const unsafe = findUnsafePortableValue(child, `${path}.${key}`);
      if (unsafe) return unsafe;
    }
  }
  return null;
};

export async function verifyHostPositionEvidence({ projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..') } = {}) {
  const failures = [];
  const packageRoot = resolve(projectRoot, PACKAGE_RELATIVE_PATH);
  const mismatch = (label, actual, expected) => {
    if (!isDeepStrictEqual(actual, expected)) {
      failures.push(`${label} differs: expected ${JSON.stringify(expected)}, received ${JSON.stringify(actual)}`);
    }
  };
  const requireCondition = (condition, message) => {
    if (!condition) failures.push(message);
  };
  const readJson = (path, label) => {
    try {
      return JSON.parse(readFileSync(path, 'utf8'));
    } catch (error) {
      failures.push(`${label} is not valid JSON: ${error instanceof Error ? error.message : String(error)}`);
      return null;
    }
  };
  const validateNestedPathBindings = (value, sourceFile, jsonPath = '$') => {
    if (Array.isArray(value)) {
      value.forEach((child, index) => validateNestedPathBindings(child, sourceFile, `${jsonPath}[${index}]`));
      return;
    }
    if (!value || typeof value !== 'object') return;

    if (typeof value.archivedPath === 'string' && !/^<source-attempt-[12]>$/u.test(value.archivedPath)) {
      failures.push(`${sourceFile} ${jsonPath}.archivedPath must identify source-original evidence, not a portable directory`);
    }
    if (typeof value.directory === 'string' && value.directory.startsWith(`${PACKAGE_RELATIVE_PATH}/attempts/`)) {
      failures.push(`${sourceFile} ${jsonPath}.directory ambiguously labels source-original metadata as portable`);
    }
    if (typeof value.path === 'string' && value.path.startsWith(`${PACKAGE_RELATIVE_PATH}/`)) {
      if (!Number.isInteger(value.bytes) || !/^[a-f0-9]{64}$/u.test(value.sha256 ?? '')) {
        failures.push(`${sourceFile} ${jsonPath}.path lacks an adjacent portable bytes/SHA binding`);
      } else {
        try {
          const directBytes = readFileSync(resolve(projectRoot, value.path));
          mismatch(`${sourceFile} ${jsonPath} direct portable bytes`, value.bytes, directBytes.length);
          mismatch(`${sourceFile} ${jsonPath} direct portable SHA-256`, value.sha256, sha256(directBytes));
        } catch (error) {
          failures.push(`${sourceFile} ${jsonPath}.path is not a readable portable artifact: ${error instanceof Error ? error.message : String(error)}`);
        }
      }
    }
    if (typeof value.path === 'string' && value.path.startsWith('<source-attempt-')) {
      requireCondition(/^<source-attempt-[123]>(?:\/.+)?$/u.test(value.path), `${sourceFile} ${jsonPath}.path has an invalid source-original label`);
    }
    for (const [key, child] of Object.entries(value)) {
      validateNestedPathBindings(child, sourceFile, `${jsonPath}.${key}`);
    }
  };

  let manifestBytes;
  let manifest;
  try {
    manifestBytes = readFileSync(join(packageRoot, 'manifest.json'));
    manifest = JSON.parse(manifestBytes.toString('utf8'));
  } catch (error) {
    return {
      failures: [`Portable host-position manifest is unreadable: ${error instanceof Error ? error.message : String(error)}`],
      result: null,
    };
  }

  mismatch('portable manifest SHA-256', sha256(manifestBytes), EXPECTED_MANIFEST_SHA256);
  requireCondition(manifest.schemaVersion === 1, 'Portable host-position manifest schemaVersion must be 1');
  requireCondition(manifest.artifactType === 'portable-host-position-e5-manifest', 'Portable host-position manifest type differs');
  requireCondition(manifest.packageRoot === PACKAGE_RELATIVE_PATH, 'Portable host-position package root differs');
  requireCondition(manifest.packageFileCountIncludingManifest === 53, 'Portable host-position package must contain 53 files');
  requireCondition(Array.isArray(manifest.files) && manifest.files.length === 52, 'Portable host-position manifest must bind 52 payload files');

  let actualTree = [];
  try {
    actualTree = listFiles(packageRoot);
  } catch (error) {
    failures.push(`Portable host-position tree is unreadable: ${error instanceof Error ? error.message : String(error)}`);
  }
  const expectedTree = ['manifest.json', ...(manifest.files ?? []).map(({ path }) => path)]
    .sort((left, right) => left.localeCompare(right, 'en'));
  mismatch('portable host-position exact tree', actualTree, expectedTree);
  requireCondition(new Set(expectedTree).size === 53, 'Portable host-position manifest contains duplicate paths');

  const fileEntries = new Map();
  for (const entry of manifest.files ?? []) {
    if (typeof entry.path !== 'string' || entry.path.includes('..') || entry.path.startsWith('/')) {
      failures.push(`Unsafe manifest path: ${JSON.stringify(entry.path)}`);
      continue;
    }
    const absolute = join(packageRoot, ...entry.path.split('/'));
    let bytes;
    try {
      bytes = readFileSync(absolute);
    } catch (error) {
      failures.push(`Missing portable payload ${entry.path}: ${error instanceof Error ? error.message : String(error)}`);
      continue;
    }
    fileEntries.set(entry.path, { entry, bytes });
    mismatch(`${entry.path} portable bytes`, bytes.length, entry.portable?.bytes);
    mismatch(`${entry.path} portable SHA-256`, sha256(bytes), entry.portable?.sha256);
    if (bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf) failures.push(`${entry.path} has a UTF-8 BOM`);
    if (bytes.includes(0x0d)) failures.push(`${entry.path} is not LF-only`);
    const text = bytes.toString('utf8');
    if (/(?:^|[\s"'=])[a-z]:[\\/]|\\\\\?\\|file:\/\/\/(?:Users|home|[a-z]:)|(?:^|[\s"'])work[\\/]|AppData|\.codex|\.npm-cache|cfut_|\bBearer\b|"(?:authorization|cookie|set-cookie)"\s*:/iu.test(text)) {
      failures.push(`${entry.path} contains a local path or secret/header material`);
    }
    if (entry.transformation === 'byte-identical') {
      mismatch(`${entry.path} byte-identical source bytes`, entry.portable?.bytes, entry.sourceOriginal?.bytes);
      mismatch(`${entry.path} byte-identical source hash`, entry.portable?.sha256, entry.sourceOriginal?.sha256);
    } else {
      const parsed = readJson(absolute, entry.path);
      if (parsed) {
        const expectedSource = {
          relativePath: entry.sourceOriginal?.relativePath,
          bytes: entry.sourceOriginal?.bytes,
          sha256: entry.sourceOriginal?.sha256,
        };
        mismatch(`${entry.path} embedded original binding`, parsed.portableEvidence?.sourceOriginal, expectedSource);
        const unsafe = findUnsafePortableValue(parsed);
        if (unsafe) failures.push(`${entry.path} has unsafe portable metadata at ${unsafe}`);
        validateNestedPathBindings(parsed, entry.path);
      }
    }
  }

  const countPrefix = (prefix) => [...fileEntries.keys()].filter((path) => path.startsWith(prefix)).length;
  mismatch('attempt-1 portable file count', countPrefix('attempts/attempt-1/'), 5);
  mismatch('attempt-2 portable file count', countPrefix('attempts/attempt-2/'), 10);
  mismatch('attempt-3 portable file count', countPrefix('attempts/attempt-3/'), 36);
  mismatch('attempt-3 raw LHR count', [...fileEntries.keys()].filter((path) => /^attempts\/attempt-3\/.+\.lhr\.json$/u.test(path)).length, 15);
  mismatch('attempt-3 portable probe count', [...fileEntries.keys()].filter((path) => /^attempts\/attempt-3\/.+\.probe\.json$/u.test(path)).length, 15);
  mismatch('attempt-3 host source binding', {
    bytes: fileEntries.get('attempts/attempt-3/host-main-document.html')?.bytes.length,
    sha256: sha256(fileEntries.get('attempts/attempt-3/host-main-document.html')?.bytes ?? Buffer.alloc(0)),
  }, EXPECTED_HOST_SOURCE);

  mismatch('source tree fingerprints', manifest.provenance?.sourceTreeFingerprints, {
    attempt1: '55ad86669cf4551bd3758d0f873aae83b1f52a157f2162a04c34a5c49f2939b6',
    attempt2: 'b59e3e8cc4b2b8f3b1b00f21969abdf49dc5b90bec7c29638df5f41800ab28a8',
    attempt3: '11daa05d44027a964f90e4ae5c831798ec4e23eae7f6069e9f221e846f867519',
    derivedCorrection: 'a553ec053626747a4b7db4cb1e75de5106aa427178d5afd8e08b340066e7740c',
  });
  mismatch('original harness hash', manifest.provenance?.originalHarnessSha256, '02bcce80b6c9b491f0b54f3b872ca906a90237ba9e12d71bca05ee7b48ccc3f8');
  mismatch('correction evaluator hash', manifest.provenance?.correctionEvaluatorSha256, '0d9bc46263f5b614cfcec9e0232f7c5a21ea4d0cbbfbac84803a26ceeeeaa684');
  mismatch('original attempt-3 failure hash', manifest.provenance?.originalAttempt3FailureSha256, '195d0cae632a0a352bdd2764471efa733e94375a7930f61d004e06676e91c9fb');

  const attempt1Failure = readJson(join(packageRoot, 'attempts/attempt-1/failure.json'), 'attempt-1 failure');
  requireCondition(
    attempt1Failure?.error?.message === 'Failed to fetch browser webSocket URL from http://<ephemeral-loopback-devtools>/json/version: fetch failed',
    'Attempt 1 must preserve the sanitized pre-navigation DevTools WebSocket failure',
  );
  requireCondition(
    ![...fileEntries.keys()].some((path) => path.startsWith('attempts/attempt-1/') && /\.(?:lhr|probe)\.json$/u.test(path)),
    'Attempt 1 must contain no measurement LHR/probe',
  );

  const attempt2Failure = readJson(join(packageRoot, 'attempts/attempt-2/failure.json'), 'attempt-2 failure');
  requireCondition(
    attempt2Failure?.error?.message?.includes('Loaded iframe must make exactly 18 app requests.'),
    'Attempt 2 must retain the superseded exact-18 rejection',
  );
  const attempt2Control = readJson(join(packageRoot, 'attempts/attempt-2/control/run-1.probe.json'), 'attempt-2 control probe');
  const attempt2Below = readJson(join(packageRoot, 'attempts/attempt-2/below-fold/run-1.probe.json'), 'attempt-2 below-fold probe');
  requireCondition(attempt2Control?.validity?.passed === true && attempt2Control?.devtools?.appRequestCount === 18, 'Attempt 2 control must preserve a valid 18-request run');
  requireCondition(attempt2Below?.validity?.passed === false && attempt2Below?.devtools?.appRequestCount === 4, 'Attempt 2 must preserve the valid four-response shell rejected by the superseded gate');

  const study = readJson(join(packageRoot, 'attempts/attempt-3/study-started.json'), 'attempt-3 study marker');
  mismatch('attempt-3 profile', study?.profile, EXPECTED_PROFILE);
  mismatch('attempt-3 Chrome flags', study?.chromeFlags, EXPECTED_CHROME_FLAGS);
  mismatch('attempt-3 rotated schedule', study?.schedule, EXPECTED_SCHEDULE);
  requireCondition(study?.tooling?.lighthouseVersion === '13.4.1', 'Attempt 3 must use Lighthouse 13.4.1');
  requireCondition(study?.tooling?.harnessSha256AtStart === manifest.provenance?.originalHarnessSha256, 'Attempt 3 harness hash differs');

  const canonicalApp = (study?.expectedLoadedAppInventory ?? []).map(({ url, method, resourceType, status }) => ({ url, method, resourceType, status }));
  const canonicalNonApp = (study?.expectedNonAppDependencyInventory ?? []).map(({ url, method, resourceType, status }) => ({ url, method, resourceType, status }));
  requireCondition(canonicalApp.length === 18, 'Attempt 3 canonical app inventory must contain 18 responses');
  requireCondition(canonicalNonApp.length === 5, 'Attempt 3 canonical non-app inventory must contain five responses');
  const canonicalAppKeys = new Set(canonicalApp.map((item) => JSON.stringify(item)));
  const canonicalBase4Keys = new Set(PAINT_SHELL_INVENTORY.map((item) => JSON.stringify(item)));

  const recomputedByVariant = Object.fromEntries(Object.keys(EXPECTED_VARIANTS).map((id) => [id, []]));
  const chronological = [];
  const pidTokens = new Set();

  for (const [variantId, expected] of Object.entries(EXPECTED_VARIANTS)) {
    const dclCounts = { hostCssApplied: 0, preHostCss: 0 };
    for (let runNumber = 1; runNumber <= 5; runNumber += 1) {
      const base = `attempts/attempt-3/${variantId}/run-${runNumber}`;
      const probeBytes = fileEntries.get(`${base}.probe.json`)?.bytes;
      const lhrBytes = fileEntries.get(`${base}.lhr.json`)?.bytes;
      if (!probeBytes || !lhrBytes) continue;
      const probe = JSON.parse(probeBytes.toString('utf8'));
      const lhr = JSON.parse(lhrBytes.toString('utf8'));
      requireCondition(probe.validity?.passed === true && probe.validity?.errors?.length === 0, `${base} original run-level validity failed`);
      requireCondition(probe.runNumber === runNumber && probe.variant?.id === variantId, `${base} run identity differs`);
      mismatch(`${base} raw-LHR hash binding`, probe.rawLhr?.sha256, sha256(lhrBytes));
      mismatch(`${base} raw-LHR byte binding`, probe.rawLhr?.bytes, lhrBytes.length);
      mismatch(`${base} raw-LHR portable path`, probe.rawLhr?.path, `${PACKAGE_RELATIVE_PATH}/${base}.lhr.json`);
      requireCondition(lhr.lighthouseVersion === '13.4.1' && lhr.runtimeError == null && lhr.runWarnings?.length === 0, `${base} Lighthouse tooling/warnings differ`);
      for (const field of ['requestedUrl', 'mainDocumentUrl', 'finalDisplayedUrl', 'finalUrl']) {
        requireCondition(lhr[field] === 'https://phphtmledit.com/', `${base} ${field} differs`);
      }
      mismatch(`${base} Lighthouse profile`, profileFromLhr(lhr), EXPECTED_PROFILE);
      const metrics = metricsFromLhr(lhr);
      mismatch(`${base} probe metric copy`, probe.lhr?.metrics, metrics);
      recomputedByVariant[variantId].push({ runNumber, metrics, score: lhr.categories?.performance?.score * 100 });

      const pid = probe.chromeProcess?.pid;
      requireCondition(typeof pid === 'string' && /^chrome-.+-run-[1-5]$/u.test(pid), `${base} portable Chrome PID token differs`);
      requireCondition(probe.chromeProcess?.cleanupExitProof?.pid === pid && probe.chromeProcess?.cleanupExitProof?.positivelyGone === true, `${base} lacks positive Chrome exit proof`);
      if (typeof pid === 'string') pidTokens.add(pid);
      chronological.push({
        variantId,
        runNumber,
        startedAt: probe.runStartedAt,
        completedAt: probe.runCompletedAt,
      });

      const appInventory = probe.devtools?.appRequestInventory ?? [];
      const expectedProgress = expected.appProgress[runNumber - 1];
      mismatch(`${base} app request count`, appInventory.length, expectedProgress);
      mismatch(`${base} delivery progress`, probe.appDelivery?.bootstrapProgress?.completedCount, expectedProgress);
      requireCondition(probe.lazyRequestOutcome === 'requested' && probe.documentOutcome === 'loaded', `${base} iframe Document was not requested and loaded`);
      requireCondition(probe.iframeRequested === true && probe.iframeNetworkLoaded === true && probe.iframeLoadEventObserved === true, `${base} iframe load axes differ`);
      requireCondition(probe.appDelivery?.iframeLoadEventCount === 1 && probe.appDelivery?.matchingTrustedLoadCount === 1, `${base} trusted iframe load count differs`);
      const observedAppKeys = new Set(appInventory.map(({ url, method, resourceType, status }) => JSON.stringify({ url, method, resourceType, status })));
      requireCondition(observedAppKeys.size === appInventory.length, `${base} app inventory contains duplicates`);
      requireCondition([...observedAppKeys].every((key) => canonicalAppKeys.has(key)), `${base} app inventory is not a canonical subset`);
      requireCondition([...canonicalBase4Keys].every((key) => observedAppKeys.has(key)), `${base} app inventory lacks the mandatory paint shell`);
      requireCondition(appInventory.every((item) => item.method === 'GET' && item.status === 200 && item.responseReceived === true && item.loadingFinished === true && item.loadingFailed == null && item.redirected === false && item.successful === true), `${base} app inventory contains an incomplete/failed response`);
      const nonApp = probe.devtools?.nonAppRequestInventory ?? [];
      mismatch(
        `${base} non-app dependency inventory`,
        nonApp.map(({ url, method, resourceType, status }) => JSON.stringify({ url, method, resourceType, status })).sort(),
        canonicalNonApp.map((item) => JSON.stringify(item)).sort(),
      );
      requireCondition(nonApp.every((item) => item.responseReceived === true && item.loadingFinished === true && item.loadingFailed == null && item.redirected === false && item.successful === true), `${base} non-app dependency contains an incomplete/failed response`);

      const documentStart = probe.pageProbe?.documentStartProbe;
      requireCondition(documentStart?.schemaVersion === 1 && documentStart?.initialHref === 'https://phphtmledit.com/' && documentStart?.appHost === 'app.phphtmledit.com', `${base} document-start identity differs`);
      requireCondition(documentStart?.documentChildCountAtInstallation === 0 && documentStart?.documentElementPresentAtInstallation === false, `${base} placement was not installed before parser children`);
      requireCondition(documentStart?.adoptedSheetCountBeforeInstallation === 0 && documentStart?.adoptedSheetCountAfterInstallation === 1 && documentStart?.adoptedSheetIndexAtInstallation === 0, `${base} constructable stylesheet installation differs`);
      requireCondition(documentStart?.stylesheetInstalledAtMs <= documentStart?.installedAtMs && documentStart?.installedAtMs <= documentStart?.observerInstalledAtMs, `${base} install/observer ordering differs`);
      requireCondition(documentStart?.placementSheetStillAdopted === true && documentStart?.iframeSeen?.length === 1 && documentStart?.iframeLoadEvents?.length === 1, `${base} placement/iframe observation differs`);
      const firstSeen = documentStart?.iframeSeen?.[0];
      requireCondition(firstSeen?.srcAttribute === 'https://app.phphtmledit.com/?theme=auto' && firstSeen?.loadingAttribute === 'lazy' && firstSeen?.title === 'HTML editor' && firstSeen?.allow === 'clipboard-write' && firstSeen?.sandbox == null && firstSeen?.stylesheetInstalledBeforeSeen === true, `${base} first-seen iframe contract differs`);
      mismatch(`${base} geometry sample labels`, documentStart?.geometrySamples?.map(({ label }) => label).sort(), [...GEOMETRY_LABELS].sort());
      mismatch(`${base} connection sample labels`, documentStart?.connectionSamples?.map(({ label }) => label).sort(), [...CONNECTION_LABELS].sort());
      requireCondition(documentStart?.connectionChanges?.length === 0 && documentStart?.connectionSamples?.every(({ effectiveType }) => effectiveType === '4g'), `${base} runtime effective connection type changed`);

      const preTop = 359.875 + expected.marginPx;
      const finalTop = expected.finalRect.top;
      for (const sample of documentStart?.geometrySamples ?? []) {
        requireCondition(rectEquals(sample.slotRect, sample.iframeRect), `${base} ${sample.label} slot/iframe rect differs`);
        requireCondition(sample.placementSheetAdopted === true && sample.computedSlotMarginTop === `${expected.marginPx}px` && sample.connection?.effectiveType === '4g', `${base} ${sample.label} placement/ECT differs`);
        let allowedRects;
        if (sample.label === 'first-seen') allowedRects = [rectWithTop(preTop)];
        else if (sample.label === 'dom-content-loaded') allowedRects = [rectWithTop(preTop), expected.finalRect];
        else allowedRects = [expected.finalRect];
        requireCondition(allowedRects.some((rect) => rectEquals(sample.slotRect, rect)), `${base} ${sample.label} geometry is outside the observed CSS states`);
        if (variantId === 'below-fold') requireCondition(sample.slotRect?.top >= 823, `${base} ${sample.label} crossed the below-fold safety floor`);
        if (variantId === 'three-viewports-down') requireCondition(sample.slotRect?.top >= 2800, `${base} ${sample.label} crossed the far-position safety floor`);
        if (sample.label === 'dom-content-loaded') {
          if (rectEquals(sample.slotRect, expected.finalRect)) dclCounts.hostCssApplied += 1;
          else if (rectEquals(sample.slotRect, rectWithTop(preTop))) dclCounts.preHostCss += 1;
        }
      }
      mismatch(`${base} final slot rect`, probe.pageProbe?.slot?.rect, expected.finalRect);
      mismatch(`${base} final iframe rect`, probe.pageProbe?.iframes?.[0]?.rect, expected.finalRect);
      mismatch(`${base} final fold class`, probe.pageProbe?.slot?.foldClass, expected.foldClass);
      mismatch(`${base} final distance below fold`, probe.pageProbe?.iframes?.[0]?.distanceBelowViewportPx, expected.finalDistanceBelowFoldPx);
      requireCondition(probe.pageProbe?.networkInformation?.effectiveType === '4g', `${base} final runtime ECT differs`);
      mismatch(`${base} host capture`, probe.source, { ...EXPECTED_HOST_SOURCE, iframeTagCount: 1, appHostLiteralCount: 1, placementMarkerCount: 0 });
    }
    mismatch(`${variantId} DCL CSS-race counts`, dclCounts, { hostCssApplied: 2, preHostCss: 3 });
  }

  chronological.sort((left, right) => Date.parse(left.startedAt) - Date.parse(right.startedAt));
  mismatch('attempt-3 chronological rotated schedule', chronological.map(({ variantId }) => variantId), EXPECTED_SCHEDULE.flat());
  requireCondition(chronological.every((run, index) => index === 0 || Date.parse(chronological[index - 1].completedAt) <= Date.parse(run.startedAt)), 'Attempt 3 fresh Chrome runs overlap');
  mismatch('attempt-3 unique Chrome process token count', pidTokens.size, 15);

  const summaryEntry = fileEntries.get('summary.json');
  mismatch('portable summary SHA-256', sha256(summaryEntry?.bytes ?? Buffer.alloc(0)), EXPECTED_SUMMARY_SHA256);
  const summary = summaryEntry ? JSON.parse(summaryEntry.bytes.toString('utf8')) : null;
  mismatch('portable summary aggregate', summary?.aggregate, {
    documentLoadedRunCount: 15,
    fullEditorAssetsRunCount: 6,
    notRequestedRunCount: 0,
    paintDeferredShellRunCount: 9,
    rawRunCount: 15,
    requestedRunCount: 15,
    runLevelPassedCount: 15,
  });
  mismatch('portable summary profile', summary?.profile, EXPECTED_PROFILE);
  mismatch('portable summary Chrome flags', summary?.executionProfile?.chromeFlags, EXPECTED_CHROME_FLAGS);
  requireCondition(summary?.executionProfile?.lighthouseMetrics === 'simulated Slow 4G with Lighthouse CPU slowdown x4', 'Portable summary must label Lighthouse metrics as simulated Slow 4G / CPU x4');
  requireCondition(summary?.executionProfile?.chromiumNativeLazyRuntimeEffectiveType === 'forced 4g by --force-effective-connection-type=4G', 'Portable summary must separately label runtime lazy-load ECT');
  requireCondition(summary?.thresholdResult?.result === 'exact-native-lazy-request-cutoff-not-bracketed' && summary?.thresholdResult?.requestTimeGeometry?.directlyObserved === false, 'Portable summary must keep the native lazy cutoff unbracketed without request-time geometry claim');
  mismatch('portable summary far-position result', summary?.thresholdResult?.farPosition, {
    documentLoadedRunCount: 5,
    earliestObservedPreHostCssDistanceBelowFoldPx: 2005.875,
    earliestObservedPreHostCssDistanceBelowFoldViewportHeights: 2.4372721749696233,
    finalDistanceBelowFoldPx: 2177.53125,
    finalDistanceBelowFoldViewportHeights: 2.6458459902794655,
    notRequestedRunCount: 0,
    requestedRunCount: 5,
  });
  requireCondition(summary?.validity?.passed === true && summary?.validity?.criterion12Evaluated === false && summary?.validity?.criterion12Result === 'not-evaluated', 'Position experiment must remain evidence-only and must not evaluate Criterion 12');
  for (const criterion of ['criterion7', 'criterion14']) {
    requireCondition(summary?.manualAcceptance?.[criterion]?.evaluated === false && summary?.manualAcceptance?.[criterion]?.result === 'not-evaluated', `Manual ${criterion} must remain not evaluated`);
  }

  for (const [variantId, expected] of Object.entries(EXPECTED_VARIANTS)) {
    const runs = recomputedByVariant[variantId].sort((left, right) => left.runNumber - right.runNumber);
    const expectedMetricStats = Object.fromEntries(Object.entries(expected.metrics).map(([name, values]) => [name, stats(values)]));
    const recomputedMetricStats = Object.fromEntries(Object.keys(METRIC_AUDITS).map((name) => [name, stats(runs.map(({ metrics }) => metrics[name]))]));
    mismatch(`${variantId} immutable raw metrics`, recomputedMetricStats, expectedMetricStats);
    mismatch(`${variantId} immutable performance scores`, runs.map(({ score }) => score), expected.scores);
    const summaryVariant = summary?.variants?.find(({ variant }) => variant?.id === variantId);
    mismatch(`${variantId} portable summary metrics`, summaryVariant?.metrics, expectedMetricStats);
    mismatch(`${variantId} portable summary score values`, summaryVariant?.performanceScoreReference?.values, expected.scores);
    mismatch(`${variantId} portable summary final rect`, summaryVariant?.geometry?.finalCanonicalRect, expected.finalRect);
    mismatch(`${variantId} portable summary final distance`, summaryVariant?.geometry?.finalDistanceBelowViewportPx, expected.finalDistanceBelowFoldPx);
    mismatch(`${variantId} portable summary DCL counts`, summaryVariant?.geometry?.domContentLoaded?.counts, { hostCssApplied: 2, preHostCss: 3 });
  }

  mismatch('portable acceptance semantics', manifest.acceptanceSemantics, {
    scope: 'native-lazy-iframe-position-experiment-evidence-only',
    packageIntegrityPassed: true,
    criterion12Evaluated: false,
    criterion12Result: 'not-evaluated',
    criterion7Evaluated: false,
    criterion7Result: 'not-evaluated',
    criterion14Evaluated: false,
    criterion14Result: 'not-evaluated',
  });

  return {
    failures,
    result: {
      package: PACKAGE_RELATIVE_PATH,
      manifestSha256: EXPECTED_MANIFEST_SHA256,
      summarySha256: EXPECTED_SUMMARY_SHA256,
      packageFileCount: actualTree.length,
      rawRunCount: 15,
      requestedAndLoadedRunCount: 15,
      fullEditorAssetsRunCount: 6,
      paintDeferredShellRunCount: 9,
      nativeLazyRequestCutoff: 'not-bracketed',
      criterion12Evaluated: false,
      manualCriteriaEvaluated: false,
      passed: failures.length === 0,
    },
  };
}

const invokedDirectly = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (invokedDirectly) {
  const verification = await verifyHostPositionEvidence();
  console.log(JSON.stringify(verification, null, 2));
  if (verification.failures.length > 0) process.exitCode = 1;
}
