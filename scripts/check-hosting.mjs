import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { isDeepStrictEqual } from 'node:util';
import { normalizeFrameAncestors } from './pages-headers.mjs';

const projectRoot = resolve(import.meta.dirname, '..');
const failures = [];
const criterion12Failures = [];
const evidenceOnly = process.argv.includes('--evidence-only');
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
const instrumentedEvidencePath = 'reports/host-instrumented-e5.json';
const expectedInstrumentedEvidenceBinding = {
  bytes: 14453,
  sha256: 'b3a06a0de261489441deb398d2b9628a61cde405b93cd0637730c4618c44f8fa',
};
const instrumentedRunCount = 5;
const expectedInstrumentedProfile = {
  formFactor: 'mobile',
  throttlingMethod: 'simulate',
  throttling: expectedSettings.throttling,
  screenEmulation: expectedSettings.screenEmulation,
  locale: 'en-US',
  onlyCategories: ['performance'],
  channel: 'cli',
  output: ['json'],
};
const expectedInstrumentedTooling = {
  lighthouseVersion: '13.4.1',
  chromeLauncherVersion: '1.2.1',
  chromeExecutableSha256: 'e14885110934a79637fcd71d76b23040333911b49fadd1bd084cef6bff78ba3a',
  nodeVersion: 'v24.19.0',
  platform: 'win32',
  architecture: 'x64',
};
const expectedHostRect = {
  top: 531.53125,
  bottom: 1272.21875,
  left: 16,
  right: 396,
  width: 380,
  height: 740.6875,
};
const expectedHostViewport = {
  innerWidth: 412,
  innerHeight: 823,
  outerWidth: 412,
  outerHeight: 823,
  documentClientWidth: 412,
  documentClientHeight: 823,
  devicePixelRatio: 1.75,
  visualViewport: {
    width: 412,
    height: 823,
    offsetLeft: 0,
    offsetTop: 0,
    pageLeft: 0,
    pageTop: 0,
    scale: 1,
  },
};
const expectedApplicationBuild = {
  gitCommit: '45ff34b568e7e21f53dbc794a05c606b51bdc93d',
  javascriptUrl: 'https://app.phphtmledit.com/assets/index-6_wYmLrV.js',
  stylesheetUrl: 'https://app.phphtmledit.com/assets/index-BX4V7LXB.css',
};
const expectedInstrumentedSourceCaptures = {
  before: {
    attempt: 2,
    sourceSummaryBytes: 66420,
    sourceSummarySha256: 'd7adbadad70d15ec46a3e9c05f71b21273ecd88f323b26bf6e4d6a2d77ab72fe',
    harnessSha256: '00ff8b0633377f68a48ed36a6b427eceff06106d1aceb262979915dc0660e606',
  },
  after: {
    attempt: 4,
    sourceSummaryBytes: 348825,
    sourceSummarySha256: '179565c52586c91304a670a01b3ebab3dc413350b35c5304b68f1a1ec6cbf4a0',
    harnessSha256: 'cf88dfd039aca2d7430ab3b4aa41e89ed98f533724abe6572449b52bcd6ded42',
  },
};
const expectedInstrumentedOriginalRuns = {
  before: [
    { lhrBytes: 486425, lhrSha256: '4289cc0ff951e334de9e8d618b8b88e015d69dd47320cf0ebc30b54f523fb95f', probeBytes: 10104, probeSha256: '4fe5b7865636499f9be217d25ea204cc90cdd594956781f4bd50b87ffb9147d8' },
    { lhrBytes: 552012, lhrSha256: '9ce049ab4383f6126f9842aa8c17077205f8ad783dac3eb8aab6e75978280913', probeBytes: 10090, probeSha256: '6510023c7c5fd98e37e206f7157131f57d6dc5d5fc51d101390976e5a6ff3b1d' },
    { lhrBytes: 573584, lhrSha256: '20649e7075a0b1b72d3298622a2a27df42f0d4f6b1f1b4ce351680215c6b4197', probeBytes: 10112, probeSha256: '3c3f03607ec6025bc5a1af4c0d320857788b0d95d9d16425891c3ac95dd89d0c' },
    { lhrBytes: 573997, lhrSha256: 'cf2f2bd4057cfdde0a9e421f29ab1085056fcf5675e3174007edd42a7ef1d80f', probeBytes: 10082, probeSha256: 'e01374fceab432e0bde0770ac37c06d68abd37651c4b8a4b3b627af444089257' },
    { lhrBytes: 551908, lhrSha256: '3a7517c3cd3a5e45eed3633f5fb7c9f86575cd389550a2e6b45e92736fbb8969', probeBytes: 10088, probeSha256: '90a63a06907eda9358875b8593b111ca1a8d31a00b60a1d270cf4fa8684fbd40' },
  ],
  after: [
    { lhrBytes: 647759, lhrSha256: '4e2c3177548d88d726407aeada83454dec9d396e09cf7734cf5faa19c6491374', probeBytes: 60851, probeSha256: 'e08064ee273cc3c58db49e0cca55d6f91c306466b73f612abb8c79d4789131d3' },
    { lhrBytes: 678092, lhrSha256: '55476290d589f93437485c234e2ddfd72dfa4de7c51009bc2f0291feeb5ed656', probeBytes: 59608, probeSha256: '80f6f5fef9a9434e39d5d7361697218f5ee988f26c09f52ff008d97fa54756e2' },
    { lhrBytes: 658527, lhrSha256: 'd0350d7bc46a9a951370711e003a16943f7cbd07f32d9e7357ea3389d97eef0f', probeBytes: 60899, probeSha256: 'd743bf1ac0ed19c80f7944e6f7f6f289627e9e258dd7897b25c683d1692f40f6' },
    { lhrBytes: 560781, lhrSha256: '1964fea009f9cbcd14777439a566a4bdfc0d0c7d49b7728bcc3d6b88032f7cf0', probeBytes: 60872, probeSha256: '8aa0d3c61cd03074569e5cf11cdf0213dedfe53b8c4de5f77643e5e6b23dd477' },
    { lhrBytes: 646953, lhrSha256: '08cfde1fa166c5da8240d3e45893e306cb825859cf33fd065de145a87a77b799', probeBytes: 60908, probeSha256: '8ade217396fcb02d892029994d5906c234c8d145ce4cc2a9375a9434d0cd367d' },
  ],
};
const expectedInstrumentedMedians = {
  before: {
    fcpMs: 1931.0522999999998,
    lcpMs: 1931.0522999999998,
    speedIndexMs: 2434.9188200086783,
    tbtMs: 0,
    cls: 0,
  },
  after: {
    fcpMs: 2743.3753,
    lcpMs: 2743.3753,
    speedIndexMs: 3300.7349626495143,
    tbtMs: 415.99999999999955,
    cls: 0,
  },
};
const expectedHostSources = {
  before: {
    bytes: 21732,
    sha256: 'c3d77a557fbbf9157860d161f259eeac1b983ed4da886b1589edd275654c8d71',
    iframeTagCount: 0,
    mainDocumentIframeTagCount: 0,
    rawIframeTagCount: 1,
    commentIframeTagCount: 1,
    appHostLiteralCount: 0,
  },
  after: {
    bytes: 21846,
    sha256: '52bd72ef0d57ddff19b387c63c479eeae1ac1ad498afb85468870e9cd42ae048',
    iframeTagCount: 1,
    mainDocumentIframeTagCount: 1,
    rawIframeTagCount: 1,
    commentIframeTagCount: 0,
    appHostLiteralCount: 1,
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

const instrumentedSettingsFromLhr = (lhr) => ({
  formFactor: lhr.configSettings?.formFactor,
  throttlingMethod: lhr.configSettings?.throttlingMethod,
  throttling: lhr.configSettings?.throttling,
  screenEmulation: lhr.configSettings?.screenEmulation,
  locale: lhr.configSettings?.locale,
  onlyCategories: lhr.configSettings?.onlyCategories,
  channel: lhr.configSettings?.channel,
  output: lhr.configSettings?.output,
});

const instrumentedMetricsFromLhr = (lhr) => ({
  fcpMs: lhr.audits?.['first-contentful-paint']?.numericValue,
  lcpMs: lhr.audits?.['largest-contentful-paint']?.numericValue,
  speedIndexMs: lhr.audits?.['speed-index']?.numericValue,
  tbtMs: lhr.audits?.['total-blocking-time']?.numericValue,
  cls: lhr.audits?.['cumulative-layout-shift']?.numericValue,
});

const findLocalPath = (value, jsonPath = '$') => {
  if (typeof value === 'string') {
    if (/^[a-z]:[\\/]/i.test(value) || /^\\\\\?\\/.test(value) ||
        /^\/(?:Users|home)\//.test(value) || /^work\/e5-host/.test(value)) {
      return `${jsonPath}: ${value}`;
    }
    return null;
  }
  if (Array.isArray(value)) {
    for (let index = 0; index < value.length; index += 1) {
      const match = findLocalPath(value[index], `${jsonPath}[${index}]`);
      if (match) return match;
    }
    return null;
  }
  if (value && typeof value === 'object') {
    for (const [key, nested] of Object.entries(value)) {
      const match = findLocalPath(nested, `${jsonPath}.${key}`);
      if (match) return match;
    }
  }
  return null;
};

const metricSeriesFromRuns = (runs) => Object.fromEntries(
  Object.keys(expectedInstrumentedMedians.before).map((metric) => {
    const values = runs.map((run) => run.metrics[metric]);
    return [metric, { values, median: median(values) }];
  }),
);

const compareInstrumentedSeries = (before, after) => Object.fromEntries(
  Object.keys(expectedInstrumentedMedians.before).map((metric) => {
    const beforeMedian = before[metric].median;
    const afterMedian = after[metric].median;
    const absoluteDelta = afterMedian - beforeMedian;
    return [metric, {
      beforeMedian,
      afterMedian,
      absoluteDelta,
      percentDelta: beforeMedian === 0 ? null : absoluteDelta / beforeMedian * 100,
      passed: Number.isFinite(beforeMedian) && Number.isFinite(afterMedian) && afterMedian <= beforeMedian,
    }];
  }),
);

let instrumentedHostEvidenceResult = null;
const verifyInstrumentedHostEvidence = async () => {
  let evidenceBytes;
  let evidence;
  try {
    evidenceBytes = await readFile(resolve(projectRoot, instrumentedEvidencePath));
    evidence = JSON.parse(evidenceBytes.toString('utf8'));
  } catch (error) {
    failures.push(`The portable E5 host evidence is unavailable: ${error instanceof Error ? error.message : String(error)}`);
    return;
  }

  reportMismatch('E5 instrumented manifest binding', {
    bytes: evidenceBytes.length,
    sha256: createHash('sha256').update(evidenceBytes).digest('hex'),
  }, expectedInstrumentedEvidenceBinding);

  const localPath = findLocalPath(evidence);
  if (localPath) failures.push(`The portable E5 host evidence contains a local path (${localPath})`);
  reportMismatch('E5 instrumented evidence identity', {
    schemaVersion: evidence.schemaVersion,
    stage: evidence.stage,
    scenario: evidence.scenario,
    result: evidence.result,
    targetUrl: evidence.targetUrl,
    appUrl: evidence.appUrl,
    appHost: evidence.appHost,
    slotSelector: evidence.slotSelector,
    runCountPerPhase: evidence.runCountPerPhase,
  }, {
    schemaVersion: 1,
    stage: 'E5',
    scenario: 'host-iframe-instrumented-lighthouse',
    result: 'measurement-valid-criterion12-failed',
    targetUrl: baselineUrl,
    appUrl: 'https://app.phphtmledit.com/?theme=auto',
    appHost: applicationHostname,
    slotSelector: '#editor-frame',
    runCountPerPhase: instrumentedRunCount,
  });
  reportMismatch('E5 instrumented profile', evidence.profile, expectedInstrumentedProfile);
  reportMismatch('E5 instrumented tooling', evidence.tooling, expectedInstrumentedTooling);
  reportMismatch('E5 instrumented application build', evidence.applicationBuild, expectedApplicationBuild);
  reportMismatch('E5 instrumented source captures', evidence.sourceCaptures, expectedInstrumentedSourceCaptures);
  reportMismatch('E5 instrumented host position', evidence.hostPosition, {
    viewport: { width: 412, height: 823, deviceScaleFactor: 1.75 },
    foldClass: 'crosses-first-fold',
    intersectsFirstViewport: true,
    toleranceCssPx: 0.5,
    rect: expectedHostRect,
  });

  const recomputedRuns = { before: [], after: [] };
  for (const phase of ['before', 'after']) {
    const artifacts = evidence.artifacts?.[phase];
    if (!Array.isArray(artifacts) || artifacts.length !== instrumentedRunCount) {
      failures.push(`E5 instrumented ${phase} evidence must contain exactly five artifact pairs`);
      continue;
    }

    for (let index = 0; index < instrumentedRunCount; index += 1) {
      const runNumber = index + 1;
      const label = `E5 instrumented ${phase} run ${runNumber}`;
      const artifact = artifacts[index];
      const expectedOriginal = expectedInstrumentedOriginalRuns[phase][index];
      const expectedLhrPath = `reports/host-instrumented-e5-${phase}-run-${runNumber}.lhr.json`;
      const expectedProbePath = `reports/host-instrumented-e5-${phase}-run-${runNumber}.probe.json`;
      reportMismatch(`${label} artifact paths`, {
        runNumber: artifact?.runNumber,
        lhr: artifact?.lhr?.repositoryFile,
        probe: artifact?.probe?.repositoryFile,
      }, {
        runNumber,
        lhr: expectedLhrPath,
        probe: expectedProbePath,
      });
      reportMismatch(`${label} original provenance`, {
        lhrBytes: artifact?.lhr?.originalBytes,
        lhrSha256: artifact?.lhr?.originalSha256,
        probeBytes: artifact?.probe?.originalBytes,
        probeSha256: artifact?.probe?.originalSha256,
      }, expectedOriginal);

      let lhrBytes;
      let probeBytes;
      try {
        [lhrBytes, probeBytes] = await Promise.all([
          readFile(resolve(projectRoot, expectedLhrPath)),
          readFile(resolve(projectRoot, expectedProbePath)),
        ]);
      } catch (error) {
        failures.push(`${label} artifact read failed: ${error instanceof Error ? error.message : String(error)}`);
        continue;
      }
      reportMismatch(`${label} tracked artifact bindings`, {
        lhrBytes: lhrBytes.length,
        lhrSha256: createHash('sha256').update(lhrBytes).digest('hex'),
        probeBytes: probeBytes.length,
        probeSha256: createHash('sha256').update(probeBytes).digest('hex'),
      }, {
        lhrBytes: artifact.lhr.bytes,
        lhrSha256: artifact.lhr.sha256,
        probeBytes: artifact.probe.bytes,
        probeSha256: artifact.probe.sha256,
      });

      let lhr;
      let probe;
      try {
        lhr = JSON.parse(lhrBytes.toString('utf8'));
        probe = JSON.parse(probeBytes.toString('utf8'));
      } catch (error) {
        failures.push(`${label} artifact JSON is invalid: ${error instanceof Error ? error.message : String(error)}`);
        continue;
      }
      for (const [kind, value] of [['LHR', lhr], ['probe', probe]]) {
        const artifactLocalPath = findLocalPath(value);
        if (artifactLocalPath) failures.push(`${label} ${kind} contains a local path (${artifactLocalPath})`);
      }

      for (const urlField of ['requestedUrl', 'mainDocumentUrl', 'finalDisplayedUrl', 'finalUrl']) {
        if (lhr[urlField] !== baselineUrl) {
          failures.push(`${label} LHR has an unexpected ${urlField}: ${JSON.stringify(lhr[urlField])}`);
        }
      }
      if (lhr.gatherMode !== 'navigation' || lhr.lighthouseVersion !== expectedTooling.lighthouse ||
          lhr.userAgent !== expectedTooling.chromeUserAgent ||
          lhr.environment?.hostUserAgent !== expectedTooling.chromeUserAgent ||
          lhr.environment?.networkUserAgent !== expectedNetworkUserAgent ||
          lhr.configSettings?.emulatedUserAgent !== expectedEmulatedUserAgent ||
          lhr.configSettings?.disableStorageReset !== false) {
        failures.push(`${label} LHR tooling or navigation mode differs from the canonical capture`);
      }
      reportMismatch(`${label} LHR profile`, instrumentedSettingsFromLhr(lhr), expectedInstrumentedProfile);
      if ((lhr.runWarnings ?? []).length !== 0 || (lhr.runtimeError ?? null) !== null) {
        failures.push(`${label} LHR contains a warning or runtime error`);
      }

      const runMetrics = instrumentedMetricsFromLhr(lhr);
      if (Object.values(runMetrics).some((value) => !Number.isFinite(value))) {
        failures.push(`${label} has a non-finite acceptance metric`);
      }
      const performanceScorePercent = lhr.categories?.performance?.score * 100;
      reportMismatch(`${label} probe identity`, {
        schemaVersion: probe.schemaVersion,
        stage: probe.stage,
        scenario: probe.scenario,
        phase: probe.phase,
        runNumber: probe.runNumber,
      }, {
        schemaVersion: 1,
        stage: 'E5',
        scenario: 'host-iframe-instrumented-lighthouse',
        phase,
        runNumber,
      });
      reportMismatch(`${label} sanitized source binding`, {
        sourceCapture: probe.sourceCapture,
        rawLhr: probe.rawLhr,
      }, {
        sourceCapture: {
          attempt: expectedInstrumentedSourceCaptures[phase].attempt,
          originalProbeBytes: expectedOriginal.probeBytes,
          originalProbeSha256: expectedOriginal.probeSha256,
        },
        rawLhr: {
          repositoryFile: expectedLhrPath,
          originalBytes: expectedOriginal.lhrBytes,
          originalSha256: expectedOriginal.lhrSha256,
        },
      });
      reportMismatch(`${label} sanitized tooling`, probe.tooling, {
        ...expectedInstrumentedTooling,
        harnessSha256: expectedInstrumentedSourceCaptures[phase].harnessSha256,
      });
      reportMismatch(`${label} probe LHR metrics`, probe.lhr?.metrics, runMetrics);
      reportMismatch(`${label} probe LHR profile`, instrumentedSettingsFromLhr(probe.lhr ?? {}), expectedInstrumentedProfile);
      if (probe.lhr?.performanceScorePercent !== performanceScorePercent ||
          probe.lhr?.lighthouseVersion !== expectedTooling.lighthouse ||
          (probe.lhr?.runWarnings ?? []).length !== 0 || probe.lhr?.runtimeError !== null) {
        failures.push(`${label} probe does not preserve the valid LHR result`);
      }
      reportMismatch(`${label} capture validity`, probe.captureValidity, { passed: true, errors: [] });

      const pageProbe = probe.pageProbe ?? {};
      reportMismatch(`${label} viewport`, pageProbe.viewport, expectedHostViewport);
      reportMismatch(`${label} Lighthouse viewport`, probe.lighthouseViewportDimensions, {
        innerWidth: 412,
        innerHeight: 823,
        outerWidth: 412,
        outerHeight: 823,
        devicePixelRatio: 1.75,
      });
      reportMismatch(`${label} scroll`, pageProbe.scroll, { x: 0, y: 0 });
      if (pageProbe.href !== baselineUrl || pageProbe.documentReadyState !== 'complete' ||
          pageProbe.visibilityState !== 'visible') {
        failures.push(`${label} page probe was not taken from the complete visible host document`);
      }
      reportMismatch(`${label} slot position`, {
        present: pageProbe.slot?.present,
        selector: pageProbe.slot?.selector,
        rect: pageProbe.slot?.rect,
        foldClass: pageProbe.slot?.foldClass,
        intersectsFirstViewport: pageProbe.slot?.intersectsFirstViewport,
        fullyInsideFirstViewport: pageProbe.slot?.fullyInsideFirstViewport,
        belowFirstViewport: pageProbe.slot?.belowFirstViewport,
        crossesFirstFold: pageProbe.slot?.crossesFirstFold,
      }, {
        present: true,
        selector: '#editor-frame',
        rect: expectedHostRect,
        foldClass: 'crosses-first-fold',
        intersectsFirstViewport: true,
        fullyInsideFirstViewport: false,
        belowFirstViewport: false,
        crossesFirstFold: true,
      });
      const postFcpSlotSample = pageProbe.documentStartProbe?.slotSamples
        ?.find(({ label: sampleLabel }) => sampleLabel === 'after-first-contentful-paint');
      reportMismatch(`${label} post-FCP slot position`, {
        rect: postFcpSlotSample?.rect,
        innerWidth: postFcpSlotSample?.innerWidth,
        innerHeight: postFcpSlotSample?.innerHeight,
        scrollX: postFcpSlotSample?.scrollX,
        scrollY: postFcpSlotSample?.scrollY,
      }, {
        rect: expectedHostRect,
        innerWidth: 412,
        innerHeight: 823,
        scrollX: 0,
        scrollY: 0,
      });
      reportMismatch(`${label} host source`, probe.source, expectedHostSources[phase]);

      const lhrRequests = lhr.audits?.['network-requests']?.details?.items ?? [];
      const lhrAppRequests = lhrRequests.filter(({ url }) => {
        try {
          return new URL(url).hostname === applicationHostname;
        } catch {
          return false;
        }
      });
      const expectedRequestCount = phase === 'before' ? 5 : 23;
      if (lhrRequests.length !== expectedRequestCount ||
          probe.lhr?.network?.requestCount !== expectedRequestCount ||
          probe.devtools?.totalRequestWillBeSentCount !== expectedRequestCount) {
        failures.push(`${label} request count differs from the accepted capture`);
      }

      if (phase === 'before') {
        reportMismatch(`${label} iframe absence`, {
          iframePresent: pageProbe.iframePresent,
          totalIframeCount: pageProbe.totalIframeCount,
          slotIframeCount: pageProbe.slotIframeCount,
          iframes: pageProbe.iframes,
          appActiveReferenceCount: pageProbe.appActiveReferenceCount,
          appActiveReferences: pageProbe.appActiveReferences,
          appResourceEntries: pageProbe.appResourceEntries,
          lighthouseIFrameElements: probe.lighthouseIFrameElements,
          iframeElementsObserved: pageProbe.documentStartProbe?.iframeElementsObserved,
          iframeLoadEvents: pageProbe.documentStartProbe?.iframeLoadEvents,
          appRequestCount: probe.devtools?.appRequestCount,
          appDocumentRequestCount: probe.devtools?.appDocumentRequestCount,
          appDocumentLoadedCount: probe.devtools?.appDocumentLoadedCount,
          appRequests: probe.devtools?.appRequests,
          lhrAppRequestCount: lhrAppRequests.length,
          iframeRequested: probe.iframeRequested,
          iframeLoadEventObserved: probe.iframeLoadEventObserved,
          iframeNetworkLoaded: probe.iframeNetworkLoaded,
          iframeLoaded: probe.iframeLoaded,
        }, {
          iframePresent: false,
          totalIframeCount: 0,
          slotIframeCount: 0,
          iframes: [],
          appActiveReferenceCount: 0,
          appActiveReferences: [],
          appResourceEntries: [],
          lighthouseIFrameElements: [],
          iframeElementsObserved: 0,
          iframeLoadEvents: [],
          appRequestCount: 0,
          appDocumentRequestCount: 0,
          appDocumentLoadedCount: 0,
          appRequests: [],
          lhrAppRequestCount: 0,
          iframeRequested: false,
          iframeLoadEventObserved: false,
          iframeNetworkLoaded: false,
          iframeLoaded: false,
        });
      } else {
        const iframe = pageProbe.iframes?.[0];
        reportMismatch(`${label} iframe contract and position`, {
          iframePresent: pageProbe.iframePresent,
          totalIframeCount: pageProbe.totalIframeCount,
          slotIframeCount: pageProbe.slotIframeCount,
          iframeCount: pageProbe.iframes?.length,
          srcAttribute: iframe?.srcAttribute,
          resolvedSrc: iframe?.resolvedSrc,
          title: iframe?.title,
          loadingAttribute: iframe?.loadingAttribute,
          loadingProperty: iframe?.loadingProperty,
          allow: iframe?.allow,
          sandbox: iframe?.sandbox,
          rect: iframe?.rect,
          foldClass: iframe?.foldClass,
          intersectsFirstViewport: iframe?.intersectsFirstViewport,
          fullyInsideFirstViewport: iframe?.fullyInsideFirstViewport,
          belowFirstViewport: iframe?.belowFirstViewport,
          crossesFirstFold: iframe?.crossesFirstFold,
          contentWindowPresent: iframe?.contentWindowPresent,
        }, {
          iframePresent: true,
          totalIframeCount: 1,
          slotIframeCount: 1,
          iframeCount: 1,
          srcAttribute: evidence.appUrl,
          resolvedSrc: evidence.appUrl,
          title: 'HTML editor',
          loadingAttribute: 'lazy',
          loadingProperty: 'lazy',
          allow: 'clipboard-write',
          sandbox: null,
          rect: expectedHostRect,
          foldClass: 'crosses-first-fold',
          intersectsFirstViewport: true,
          fullyInsideFirstViewport: false,
          belowFirstViewport: false,
          crossesFirstFold: true,
          contentWindowPresent: true,
        });
        reportMismatch(`${label} iframe host references`, {
          appActiveReferenceCount: pageProbe.appActiveReferenceCount,
          appActiveReferences: pageProbe.appActiveReferences?.map(({ tagName, attribute, raw, resolved }) => ({ tagName, attribute, raw, resolved })),
          appResourceEntries: pageProbe.appResourceEntries?.map(({ name, initiatorType }) => ({ name, initiatorType })),
          iframeElementsObserved: pageProbe.documentStartProbe?.iframeElementsObserved,
          iframeLoadEvents: pageProbe.documentStartProbe?.iframeLoadEvents?.map(({ isTrusted, srcAttribute, resolvedSrc }) => ({ isTrusted, srcAttribute, resolvedSrc })),
          lighthouseIframeCount: probe.lighthouseIFrameElements?.length,
          lighthouseIframeSrc: probe.lighthouseIFrameElements?.[0]?.src,
          lighthouseIframeRect: probe.lighthouseIFrameElements?.[0]?.clientRect,
        }, {
          appActiveReferenceCount: 1,
          appActiveReferences: [{ tagName: 'iframe', attribute: 'src', raw: evidence.appUrl, resolved: evidence.appUrl }],
          appResourceEntries: [{ name: evidence.appUrl, initiatorType: 'iframe' }],
          iframeElementsObserved: 1,
          iframeLoadEvents: [{ isTrusted: true, srcAttribute: evidence.appUrl, resolvedSrc: evidence.appUrl }],
          lighthouseIframeCount: 1,
          lighthouseIframeSrc: evidence.appUrl,
          lighthouseIframeRect: expectedHostRect,
        });
        reportMismatch(`${label} iframe load proof`, {
          appRequestCount: probe.devtools?.appRequestCount,
          appDocumentRequestCount: probe.devtools?.appDocumentRequestCount,
          appDocumentLoadedCount: probe.devtools?.appDocumentLoadedCount,
          devtoolsIframeRequested: probe.devtools?.iframeRequested,
          devtoolsIframeNetworkLoaded: probe.devtools?.iframeNetworkLoaded,
          lhrAppRequestCount: lhrAppRequests.length,
          iframeRequested: probe.iframeRequested,
          iframeLoadEventObserved: probe.iframeLoadEventObserved,
          iframeNetworkLoaded: probe.iframeNetworkLoaded,
          iframeLoaded: probe.iframeLoaded,
        }, {
          appRequestCount: 18,
          appDocumentRequestCount: 1,
          appDocumentLoadedCount: 1,
          devtoolsIframeRequested: true,
          devtoolsIframeNetworkLoaded: true,
          lhrAppRequestCount: 18,
          iframeRequested: true,
          iframeLoadEventObserved: true,
          iframeNetworkLoaded: true,
          iframeLoaded: true,
        });
        const devtoolsAppRequests = probe.devtools?.appRequests ?? [];
        const finishedAppDocuments = devtoolsAppRequests.filter(({ url, resourceType, response, loadingFinished, loadingFailed }) =>
          url === evidence.appUrl && resourceType === 'Document' && response?.status === 200 &&
          loadingFinished !== null && loadingFinished !== undefined && loadingFailed === null);
        if (devtoolsAppRequests.length !== 18 || finishedAppDocuments.length !== 1 ||
            devtoolsAppRequests.some(({ response, loadingFinished, loadingFailed }) =>
              response?.status !== 200 || loadingFinished === null || loadingFinished === undefined || loadingFailed !== null)) {
          failures.push(`${label} does not contain 18 finished successful app requests including one Document`);
        }
        const expectedAssetUrls = [expectedApplicationBuild.javascriptUrl, expectedApplicationBuild.stylesheetUrl].sort();
        const devtoolsAssetUrls = devtoolsAppRequests.map(({ url }) => url).filter((url) => url.includes('/assets/')).sort();
        const lhrAssetUrls = lhrAppRequests.map(({ url }) => url).filter((url) => url.includes('/assets/')).sort();
        reportMismatch(`${label} DevTools build assets`, devtoolsAssetUrls, expectedAssetUrls);
        reportMismatch(`${label} Lighthouse build assets`, lhrAssetUrls, expectedAssetUrls);
      }
      recomputedRuns[phase].push({ runNumber, metrics: runMetrics, performanceScorePercent });
    }
  }

  if (recomputedRuns.before.length !== instrumentedRunCount ||
      recomputedRuns.after.length !== instrumentedRunCount) return;
  const recomputedMedians = {
    before: metricSeriesFromRuns(recomputedRuns.before),
    after: metricSeriesFromRuns(recomputedRuns.after),
  };
  reportMismatch('E5 instrumented metric series and medians', evidence.medians, recomputedMedians);
  reportMismatch('E5 instrumented exact accepted medians', {
    before: Object.fromEntries(Object.entries(recomputedMedians.before).map(([metric, result]) => [metric, result.median])),
    after: Object.fromEntries(Object.entries(recomputedMedians.after).map(([metric, result]) => [metric, result.median])),
  }, expectedInstrumentedMedians);
  const recomputedComparison = compareInstrumentedSeries(recomputedMedians.before, recomputedMedians.after);
  reportMismatch('E5 instrumented criterion 12 comparison', evidence.comparison, recomputedComparison);
  reportMismatch('E5 instrumented criterion 12 metric copy', evidence.criterion12?.metrics, recomputedComparison);
  const failedMetrics = Object.entries(recomputedComparison)
    .filter(([, result]) => !result.passed)
    .map(([metric]) => metric);
  reportMismatch('E5 instrumented criterion 12 failed metrics', evidence.criterion12?.failedMetrics, failedMetrics);
  if (evidence.measurementValidity?.passed !== true) {
    failures.push('E5 instrumented evidence must remain measurement-valid');
  }
  if (evidence.criterion12?.passed !== false || failedMetrics.length !== 4 ||
      isDeepStrictEqual(failedMetrics, ['fcpMs', 'lcpMs', 'speedIndexMs', 'tbtMs']) === false) {
    failures.push('E5 instrumented evidence must preserve the criterion 12 FAIL across FCP, LCP, Speed Index, and TBT');
  }
  if (recomputedRuns.after.some(({ metrics }) => metrics.cls !== 0)) {
    failures.push('E5 instrumented AFTER evidence must preserve CLS=0 in all five runs');
  }

  instrumentedHostEvidenceResult = {
    artifact: instrumentedEvidencePath,
    bytes: evidenceBytes.length,
    sha256: createHash('sha256').update(evidenceBytes).digest('hex'),
    sourceCaptures: evidence.sourceCaptures,
    applicationBuild: evidence.applicationBuild,
    beforeMedians: expectedInstrumentedMedians.before,
    afterMedians: expectedInstrumentedMedians.after,
    afterClsPerRun: recomputedRuns.after.map(({ metrics }) => metrics.cls),
    measurementValidityPassed: true,
    criterion12Passed: false,
    criterion12FailedMetrics: failedMetrics,
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
  verifyInstrumentedHostEvidence(),
]);

if (instrumentedHostEvidenceResult?.criterion12Passed !== true) {
  criterion12Failures.push('TZ 2.9 criterion 12 is not satisfied: FCP, LCP, Speed Index, and TBT regress after the loaded iframe is embedded');
}

console.log(JSON.stringify({
  artifacts: artifacts.map(([, , path]) => path),
  instrumentedHostEvidence: instrumentedHostEvidenceResult,
  evidenceIntegrityPassed: failures.length === 0,
  criterion12AcceptancePassed: failures.length === 0 && criterion12Failures.length === 0,
  manualChecksEvaluated: false,
  pendingManualChecks: [
    'allowed-origin framing and clipboard delegation',
    'clipboard fallback without allow="clipboard-write" and without false success',
    'negative phe-preview.com framing denial',
  ],
  evidenceFailures: failures,
  criterion12Failures,
  mode: evidenceOnly ? 'evidence-integrity' : 'criterion12-acceptance',
}, null, 2));
if (failures.length > 0 || (!evidenceOnly && criterion12Failures.length > 0)) process.exitCode = 1;
