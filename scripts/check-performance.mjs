import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const projectRoot = resolve(import.meta.dirname, '..');
const reportsRoot = resolve(projectRoot, 'reports');
const reportPaths = Object.freeze({
  desktop: resolve(reportsRoot, 'performance-e5-desktop-gate.json'),
  slow4g: resolve(reportsRoot, 'performance-e5-slow4g-comparison.json'),
  invalidSlow4g: resolve(reportsRoot, 'performance-e5-slow4g-fresh-baseline-invalid-attempt.json'),
  delivery: resolve(reportsRoot, 'delivery-e5-production-wire.json'),
  readyGap: resolve(reportsRoot, 'performance-e5-ready-gap.json'),
  invalidReadyGap: resolve(reportsRoot, 'performance-e5-ready-gap-invalid-attempt.json'),
});

const DESKTOP_PROFILE = Object.freeze({
  name: 'Lighthouse desktop, DevTools exact transport with no CPU slowdown',
  networkMethod: 'Network.emulateNetworkConditions',
  cpuMethod: 'Emulation.setCPUThrottlingRate',
  offline: false,
  latencyMs: 40,
  downloadBitsPerSecond: 10_240_000,
  downloadBytesPerSecond: 1_280_000,
  uploadBitsPerSecond: 10_240_000,
  uploadBytesPerSecond: 1_280_000,
  connectionType: 'wifi',
  cpuSlowdownMultiplier: 1,
});
const SLOW_4G_PROFILE = Object.freeze({
  name: 'Lighthouse Slow 4G, DevTools exact transport with CPU x4',
  networkMethod: 'Network.emulateNetworkConditions',
  cpuMethod: 'Emulation.setCPUThrottlingRate',
  offline: false,
  latencyMs: 150,
  downloadBitsPerSecond: 1_600_000,
  downloadBytesPerSecond: 200_000,
  uploadBitsPerSecond: 750_000,
  uploadBytesPerSecond: 93_750,
  connectionType: 'cellular4g',
  cpuSlowdownMultiplier: 4,
});
const SKELETON_LIMIT_MS = 1_000;
const READY_LIMIT_MS = 2_500;
const SLOW_4G_REGRESSION_LIMIT_PERCENT = 15;
const FULL_WIRE_LIMIT_BYTES = 650_000;
const CURRENT_E5_REVISION = '45ff34b568e7e21f53dbc794a05c606b51bdc93d';
const CURRENT_E5_URL = 'https://97794bf1.phphtmledit-editor.pages.dev/';
const ACCEPTED_E4_REVISION = '869ce7fc2f8823feb71ce1d674f46aeae7b548ad';
const ACCEPTED_E4_URL = 'https://5be873d1.phphtmledit-editor.pages.dev/';
const HISTORICAL_DC818_REVISION = 'dc818598d16003aed8fe7b429303077a508c22c9';
const HISTORICAL_DC818_URL = 'https://b200e6d7.phphtmledit-editor.pages.dev/';
const failures = [];

const failUnless = (condition, message) => {
  if (!condition) failures.push(message);
};
const finite = (value) => typeof value === 'number' && Number.isFinite(value);
const close = (left, right, tolerance = 0.001) =>
  finite(left) && finite(right) && Math.abs(left - right) <= tolerance;
const median = (values) => {
  const sorted = [...values].sort((left, right) => left - right);
  return sorted[Math.floor(sorted.length / 2)];
};
const assertProfile = (actual, expected, label) => {
  for (const [key, value] of Object.entries(expected)) {
    failUnless(actual?.[key] === value, `${label}: profile ${key} must be ${value}, got ${actual?.[key]}`);
  }
};
const assertTrueFields = (object, fields, label) => {
  for (const field of fields) {
    failUnless(object?.[field] === true, `${label}: ${field} must be true`);
  }
};
const loadJson = async (path) => JSON.parse(await readFile(path, 'utf8'));

const [desktop, slow4g, invalidSlow4g, delivery, readyGap, invalidReadyGap] = await Promise.all(
  Object.values(reportPaths).map(loadJson),
);

// Blocking Lighthouse desktop timing gate (TZ 2.9, section 7).
failUnless(desktop.stage === 'E5', 'desktop: stage must be E5');
failUnless(desktop.specification === 'TZ 2.9 section 7', 'desktop: specification must be TZ 2.9 section 7');
failUnless(desktop.canonicalByteBudgetInput === true, 'desktop: deployed wire values must be canonical budget input');
failUnless(desktop.canonicalHar === false, 'desktop: timing evidence must not claim to be a canonical HAR');
failUnless(desktop.deployment?.revision === CURRENT_E5_REVISION && desktop.deployment?.url === CURRENT_E5_URL,
  'desktop: deployment must be the pinned current E5 revision and immutable URL');
failUnless(desktop.methodology?.runCount === 3, 'desktop: methodology must require exactly three runs');
assertProfile(desktop.profile, DESKTOP_PROFILE, 'desktop summary');
failUnless(desktop.completeRunCount === 3 && desktop.expectedRunCount === 3, 'desktop: exactly 3/3 complete runs are required');
failUnless(Array.isArray(desktop.runs) && desktop.runs.length === 3, 'desktop: summary must contain exactly three raw runs');

const desktopSkeletonValues = [];
const desktopReadyValues = [];
const desktopWireValues = [];
for (const [index, run] of (desktop.runs ?? []).entries()) {
  const label = `desktop run ${index + 1}`;
  failUnless(run.runNumber === index + 1 && run.runCount === 3, `${label}: run numbering must be exact`);
  failUnless(run.revision === desktop.deployment?.revision && run.requestedUrl === desktop.deployment?.url &&
    run.finalUrl === desktop.deployment?.url,
  `${label}: revision, requested URL, and final URL must match the pinned desktop deployment`);
  failUnless(run.captureComplete === true, `${label}: capture must be complete`);
  assertProfile(run.profile, DESKTOP_PROFILE, label);
  assertTrueFields(run.coldLoad, [
    'freshChromeProfile',
    'cacheDisabled',
    'browserCacheCleared',
    'browserCookiesCleared',
    'serviceWorkerBypassed',
  ], label);
  assertTrueFields(run.assertions, [
    'exactLighthouseDesktopProfileApplied',
    'performancePaintTimingObserved',
    'skeletonVisibleAndNonzeroAtFcp',
    'passiveUserAccessibleStateRecheckedAtArm',
    'canonicalVisualAcceptedTrustedSentinelInput',
    'canonicalVisualSentinelRolledBack',
    'canonicalReadinessIsTrustedInputAcceptance',
    'sourceRichAbsentFromCanonicalReadinessWindow',
    'sourceRichRequestedExactlyOncePostMetric',
    'tinyCoreRequestedExactlyOnce',
    'noFailedHttpRequests',
    'noConsoleErrorsOrWarnings',
    'noFatalFallback',
    'canonicalRequestCountExactly18',
    'canonicalFullWireCaptured',
  ], label);

  const skeleton = run.metrics?.navigationToSkeletonPaintMs;
  const fromSkeletonToReady = run.metrics?.skeletonPaintToEditorReadyMs;
  const ready = run.metrics?.navigationToEditorReadyMs;
  failUnless(finite(skeleton) && finite(fromSkeletonToReady) && finite(ready), `${label}: all startup metrics must be finite`);
  failUnless(close(skeleton + fromSkeletonToReady, ready, 0.1), `${label}: startup metric partition is inconsistent`);
  failUnless(run.paintProof?.skeletonVisibleAtFcp === true, `${label}: visible skeleton must span FCP`);
  failUnless(close(run.paintProof?.firstContentfulPaintAt, skeleton), `${label}: FCP and skeleton timing must be identical`);

  const canonicalWindow = run.network?.canonicalReadinessWindow;
  const wire = canonicalWindow?.fullWireBytes;
  failUnless(canonicalWindow?.requestCount === 18, `${label}: canonical startup must contain exactly 18 eager requests`);
  failUnless(canonicalWindow?.sourceRichRequestCount === 0, `${label}: source-rich must be absent before readiness`);
  failUnless(Array.isArray(canonicalWindow?.requests) && canonicalWindow.requests.length === 18, `${label}: canonical request inventory must contain 18 entries`);
  failUnless(finite(wire), `${label}: full wire bytes must be finite`);
  const recomputedWire = (canonicalWindow?.requests ?? []).reduce((sum, request) =>
    sum + (finite(request.encodedDataLength) ? request.encodedDataLength : Number.NaN), 0);
  failUnless(finite(recomputedWire) && wire === recomputedWire,
    `${label}: full wire bytes must equal the sum of all 18 encodedDataLength values`);
  const documentRequests = (canonicalWindow?.requests ?? []).filter(({ type }) => type === 'Document');
  failUnless(documentRequests.length === 1 && documentRequests[0].url === desktop.deployment?.url,
    `${label}: canonical inventory must contain one Document for the pinned immutable URL`);
  failUnless(wire <= FULL_WIRE_LIMIT_BYTES, `${label}: ${wire} full wire bytes exceed ${FULL_WIRE_LIMIT_BYTES}`);
  failUnless(run.desktopBlockingGate?.actualFullWireBytes === wire, `${label}: wire total is inconsistent across the report`);

  desktopSkeletonValues.push(skeleton);
  desktopReadyValues.push(ready);
  desktopWireValues.push(wire);
}

const desktopSkeletonMedian = median(desktopSkeletonValues);
const desktopReadyMedian = median(desktopReadyValues);
const desktopWireMedian = median(desktopWireValues);
failUnless(close(desktop.medians?.navigationToSkeletonPaintMs, desktopSkeletonMedian), 'desktop: reported skeleton median is not reproducible');
failUnless(close(desktop.medians?.navigationToEditorReadyMs, desktopReadyMedian), 'desktop: reported readiness median is not reproducible');
failUnless(desktop.medians?.canonicalFullWireBytes === desktopWireMedian, 'desktop: reported wire median is not reproducible');
failUnless(desktop.thresholds?.blocking === true, 'desktop: the timing and wire thresholds must be blocking');
failUnless(desktop.thresholds?.values?.navigationToSkeletonPaintMs === SKELETON_LIMIT_MS, 'desktop: skeleton limit must be 1000 ms');
failUnless(desktop.thresholds?.values?.navigationToEditorReadyMs === READY_LIMIT_MS, 'desktop: readiness limit must be 2500 ms');
failUnless(desktop.thresholds?.values?.fullWireBytes === FULL_WIRE_LIMIT_BYTES, 'desktop: full wire limit must be 650000 bytes');
failUnless(desktopSkeletonMedian <= SKELETON_LIMIT_MS, `desktop: median skeleton paint ${desktopSkeletonMedian} ms exceeds ${SKELETON_LIMIT_MS} ms`);
failUnless(desktopReadyMedian <= READY_LIMIT_MS, `desktop: median trusted readiness ${desktopReadyMedian} ms exceeds ${READY_LIMIT_MS} ms`);
failUnless(desktop.acceptance?.allPassed === true, 'desktop: evidence summary must pass every acceptance check');

// Slow 4G is published diagnostics. Only a readiness regression over 15% blocks.
failUnless(slow4g.specification === 'TZ 2.9 section 7', 'Slow 4G: specification must be TZ 2.9 section 7');
failUnless(slow4g.reportType === 'deployed Slow 4G readiness-regression diagnostic',
  'Slow 4G: report type must describe the TZ 2.9 readiness-regression diagnostic');
failUnless(slow4g.slow4gReferenceThresholds?.blocking === false, 'Slow 4G absolute thresholds must be explicitly non-blocking');
failUnless(slow4g.methodology?.runCountPerDeployment === 3, 'Slow 4G: exactly three runs per deployment are required');
assertProfile(slow4g.methodology?.profile, SLOW_4G_PROFILE, 'Slow 4G summary');
const before = slow4g.profiles?.before;
const after = slow4g.profiles?.after;
failUnless(before?.revision === ACCEPTED_E4_REVISION && before?.url === ACCEPTED_E4_URL,
  'Slow 4G before: accepted E4 revision and immutable URL must remain pinned');
failUnless(after?.revision === CURRENT_E5_REVISION && after?.url === CURRENT_E5_URL,
  'Slow 4G after: current E5 revision and immutable URL must remain pinned');
failUnless(Array.isArray(before?.runs) && before.runs.length === 3, 'Slow 4G before: exactly three runs are required');
failUnless(Array.isArray(after?.runs) && after.runs.length === 3, 'Slow 4G after: exactly three runs are required');

const readinessValues = (profile, label) => (profile?.runs ?? []).map((run, index) => {
  failUnless(run.runNumber === index + 1 && run.runCount === 3, `${label} run ${index + 1}: run numbering must be exact`);
  failUnless(run.revision === profile?.revision && run.requestedUrl === profile?.url && run.finalUrl === profile?.url,
    `${label} run ${index + 1}: revision, requested URL, and final URL must match its immutable profile`);
  assertProfile(run.profile, SLOW_4G_PROFILE, `${label} run ${index + 1}`);
  assertTrueFields(run.assertions, [
    'canonicalVisualAcceptedTrustedSentinelInput',
    'canonicalVisualSentinelRolledBack',
    'canonicalReadinessIsTrustedInputAcceptance',
    'sourceRichAbsentFromCanonicalReadinessWindow',
    'noFailedHttpRequests',
    'noConsoleErrorsOrWarnings',
    'noFatalFallback',
  ], `${label} run ${index + 1}`);
  const value = run.metrics?.navigationToEditorReadyMs;
  failUnless(finite(value), `${label} run ${index + 1}: trusted-input readiness must be finite`);
  failUnless(close(run.readinessProof?.editorReadyAt, value), `${label} run ${index + 1}: readiness proof and metric differ`);
  return value;
});
const beforeReadyMedian = median(readinessValues(before, 'Slow 4G E4'));
const afterReadyMedian = median(readinessValues(after, 'Slow 4G E5'));
const readinessRegressionPercent = ((afterReadyMedian - beforeReadyMedian) / beforeReadyMedian) * 100;
failUnless(readinessRegressionPercent <= SLOW_4G_REGRESSION_LIMIT_PERCENT,
  `Slow 4G: readiness regressed ${readinessRegressionPercent.toFixed(2)}%, over the ${SLOW_4G_REGRESSION_LIMIT_PERCENT}% limit`);
failUnless(close(after?.medians?.navigationToEditorReadyMs, afterReadyMedian), 'Slow 4G after: readiness median is not reproducible');
failUnless(close(slow4g.comparison?.navigationToEditorReadyDeltaMs, afterReadyMedian - beforeReadyMedian, 0.1),
  'Slow 4G: reported readiness delta is not reproducible');
failUnless(close(slow4g.comparison?.navigationToEditorReadyChangePercent, readinessRegressionPercent, 0.001),
  'Slow 4G: reported readiness percentage is not reproducible');
failUnless(slow4g.comparison?.readinessRegressionLimitPercent === SLOW_4G_REGRESSION_LIMIT_PERCENT &&
  slow4g.comparison?.readinessRegressionPass === true,
  'Slow 4G: comparison must apply the 15% readiness-regression gate');
failUnless(slow4g.acceptance?.absoluteThresholdsBlocking === false &&
  slow4g.acceptance?.beforeReadinessObservations === 3 &&
  slow4g.acceptance?.afterReadinessObservations === 3 &&
  slow4g.acceptance?.readinessRegressionPass === true &&
  slow4g.acceptance?.allPassed === true,
  'Slow 4G: outer TZ 2.9 acceptance metadata contradicts the valid readiness result');

const strictBeforePaintProofs = (before?.runs ?? []).filter((run) =>
  run.paintProof?.skeletonVisibleAtFcp === true && finite(run.metrics?.navigationToSkeletonPaintMs)).length;
const strictAfterPaintProofs = (after?.runs ?? []).filter((run) =>
  run.paintProof?.skeletonVisibleAtFcp === true && finite(run.metrics?.navigationToSkeletonPaintMs)).length;
failUnless(strictBeforePaintProofs === 1, `Slow 4G E4: expected strict skeleton proof in 1/3 runs, got ${strictBeforePaintProofs}/3`);
failUnless(strictAfterPaintProofs === 3, `Slow 4G E5: expected strict skeleton proof in 3/3 runs, got ${strictAfterPaintProofs}/3`);
failUnless(before?.allRunsProveSkeletonAtFcp === false, 'Slow 4G E4: skeleton series must remain explicitly incomplete/non-comparable');
failUnless(before?.medians?.navigationToSkeletonPaintMs === null, 'Slow 4G E4: no strict skeleton median may be reported from 1/3 proofs');
failUnless(slow4g.comparison?.navigationToSkeletonPaintDeltaMs === null, 'Slow 4G: skeleton delta must remain null/non-comparable');
failUnless(after?.allRunsProveSkeletonAtFcp === true && after?.completeRunCount === 3, 'Slow 4G E5: skeleton proof must be complete in all three runs');

// The one fresh E4+E5 comparison attempt is retained exactly because its E4
// strict whole-run series was incomplete. Its current-E5 runs are the same
// valid runs embedded in the accepted derived comparison above.
failUnless(invalidSlow4g.specification === 'TZ 2.9 section 7', 'invalid Slow 4G attempt: specification must be TZ 2.9 section 7');
failUnless(invalidSlow4g.validMeasurement === false && invalidSlow4g.excludedFromAcceptedRegressionComparison === true,
  'invalid Slow 4G attempt must be explicitly excluded from the accepted regression metric');
failUnless(invalidSlow4g.acceptance?.allPassed === false,
  'invalid Slow 4G attempt must retain its original failing outer acceptance');
failUnless(invalidSlow4g.profiles?.before?.completeRunCount === 2 && invalidSlow4g.profiles?.before?.expectedRunCount === 3,
  'invalid Slow 4G attempt must retain the incomplete 2/3 fresh E4 baseline');
failUnless(invalidSlow4g.profiles?.after?.completeRunCount === 3 && invalidSlow4g.profiles?.after?.expectedRunCount === 3,
  'invalid Slow 4G attempt must retain all three valid current-E5 runs');
failUnless(Array.isArray(invalidSlow4g.profiles?.before?.runs) && invalidSlow4g.profiles.before.runs.length === 3 &&
  invalidSlow4g.profiles.before.runs.filter(({ captureComplete }) => captureComplete === true).length === 2,
  'invalid Slow 4G attempt must embed all three fresh E4 runs with the original 2/3 completion distribution');
readinessValues(invalidSlow4g.profiles?.before, 'invalid fresh Slow 4G E4');
failUnless(JSON.stringify(invalidSlow4g.profiles?.after?.runs) === JSON.stringify(after?.runs),
  'invalid Slow 4G attempt and accepted wrapper must embed the same current-E5 runs');
failUnless(invalidSlow4g.profiles?.after?.revision === desktop.deployment?.revision &&
  invalidSlow4g.profiles?.after?.url === desktop.deployment?.url,
  'invalid Slow 4G attempt must remain bound to the current immutable E5 deployment');

// Historical deployed encoding diagnostic: all 54 dc818 responses were Brotli,
// with 18 eager requests/run and no lazy source chunk. The current blocking
// full-wire value comes from the three current desktop runs above.
assertProfile(delivery.methodology?.profile, {
  latencyMs: SLOW_4G_PROFILE.latencyMs,
  downloadBytesPerSecond: SLOW_4G_PROFILE.downloadBytesPerSecond,
  uploadBytesPerSecond: SLOW_4G_PROFILE.uploadBytesPerSecond,
  connectionType: SLOW_4G_PROFILE.connectionType,
  cpuSlowdownMultiplier: SLOW_4G_PROFILE.cpuSlowdownMultiplier,
}, 'delivery');
failUnless(delivery.allRunsValid === true, 'delivery: every diagnostic run must be valid');
failUnless(Array.isArray(delivery.runs) && delivery.runs.length === 3, 'delivery: exactly three runs are required');
let brotliResponseCount = 0;
const deliveryWireValues = [];
for (const [index, run] of (delivery.runs ?? []).entries()) {
  const label = `delivery run ${index + 1}`;
  failUnless(run.summary?.requestCount === 18, `${label}: exactly 18 eager requests are required`);
  failUnless(run.summary?.sourceRichRequestCount === 0, `${label}: source-rich must remain absent`);
  failUnless(JSON.stringify(run.summary?.encodingCounts) === JSON.stringify({ br: 18 }), `${label}: all responses must be Brotli`);
  failUnless(Array.isArray(run.requests) && run.requests.length === 18, `${label}: response inventory must contain 18 requests`);
  const brotliInRun = (run.requests ?? []).filter(({ contentEncoding }) => contentEncoding === 'br').length;
  failUnless(brotliInRun === 18, `${label}: ${brotliInRun}/18 responses use Brotli`);
  brotliResponseCount += brotliInRun;
  assertTrueFields(run.assertions, [
    'exactlyEighteenEagerRequests',
    'sourceRichNeverRequested',
    'allResponsesSuccessful',
    'cacheAndServiceWorkerUnused',
    'networkIdleObserved',
  ], label);
  const wire = run.summary?.bytes?.totalEncodedBytes;
  failUnless(finite(wire), `${label}: full wire total must be finite`);
  failUnless(wire <= FULL_WIRE_LIMIT_BYTES, `${label}: ${wire} full wire bytes exceed ${FULL_WIRE_LIMIT_BYTES}`);
  deliveryWireValues.push(wire);
}
failUnless(brotliResponseCount === 54, `delivery: expected Brotli in 54/54 responses, got ${brotliResponseCount}/54`);
const deliveryWireMedian = median(deliveryWireValues);
failUnless(delivery.medians?.totalEncodedBytes === deliveryWireMedian, 'delivery: reported full wire median is not reproducible');
failUnless(deliveryWireMedian <= FULL_WIRE_LIMIT_BYTES, `delivery: median ${deliveryWireMedian} full wire bytes exceeds ${FULL_WIRE_LIMIT_BYTES}`);
failUnless(Array.isArray(delivery.responseMatrix) && delivery.responseMatrix.length === 18, 'delivery: response matrix must contain all 18 eager resources');
const matrixObservations = (delivery.responseMatrix ?? []).flatMap(({ observations }) => observations ?? []);
failUnless(matrixObservations.length === 54 && matrixObservations.every(({ contentEncoding }) => contentEncoding === 'br'),
  'delivery: response matrix must independently show Brotli in 54/54 observations');

// One-navigation verdict for the editor-ready mark versus accepted trusted input.
failUnless(readyGap.runCount === 1 && readyGap.assertions?.exactlyOneRun === true, 'ready gap: exactly one valid run is required');
assertProfile(readyGap.profile, {
  latencyMs: SLOW_4G_PROFILE.latencyMs,
  downloadBytesPerSecond: SLOW_4G_PROFILE.downloadBytesPerSecond,
  uploadBytesPerSecond: SLOW_4G_PROFILE.uploadBytesPerSecond,
  connectionType: SLOW_4G_PROFILE.connectionType,
  cpuSlowdownMultiplier: SLOW_4G_PROFILE.cpuSlowdownMultiplier,
}, 'ready gap');
assertTrueFields(readyGap.assertions, [
  'sameNavigationContainsMarkPassiveAndTrustedInput',
  'passiveStateStillCurrentAtArm',
  'trustedTinyInputAccepted',
  'codeMirrorNeverFocused',
  'sourceRichNeverRequested',
  'noFatalFallback',
], 'ready gap');
const markAt = readyGap.pageTimelineMs?.productEditorReadyMarkAt;
const trustedInputAt = readyGap.pageTimelineMs?.trustedInputAcceptedAt;
const sameRunMarkToInputMs = trustedInputAt - markAt;
failUnless(finite(markAt) && finite(trustedInputAt) && trustedInputAt > markAt, 'ready gap: mark/input chronology is invalid');
failUnless(close(readyGap.pageTimelineMs?.productMarkToTrustedAcceptanceMs, sameRunMarkToInputMs, 0.1), 'ready gap: reported same-run gap is not reproducible');
failUnless(readyGap.network?.requestCountThroughAcceptance === 18, 'ready gap: canonical interval must contain 18 requests');
failUnless(readyGap.network?.sourceRichRequestCount === 0, 'ready gap: source-rich must be absent through accepted input');
failUnless(readyGap.currentStateAtArm?.appBusy === 'false' && readyGap.currentStateAtArm?.skeletonHidden === true,
  'ready gap: current passive state must be rechecked immediately before input');
failUnless(typeof readyGap.interpretationPolicy === 'string' && readyGap.interpretationPolicy.includes('same navigation'),
  'ready gap: interpretation policy must forbid cross-series endpoint comparison');

failUnless(invalidReadyGap.validMeasurement === false, 'invalid ready-gap attempt must never be treated as a measurement');
failUnless(invalidReadyGap.replacementAuthorised === true, 'invalid ready-gap attempt must document the authorised replacement');
failUnless(invalidReadyGap.targetRevision === readyGap.targetRevision, 'ready gap: invalid attempt and replacement must target the same revision');
failUnless(invalidReadyGap.targetUrl === readyGap.targetUrl, 'ready gap: invalid attempt and replacement must target the same URL');
failUnless(Date.parse(invalidReadyGap.capturedAt) < Date.parse(readyGap.capturedAt), 'ready gap: valid replacement must postdate the invalid attempt');
failUnless(typeof invalidReadyGap.failurePhase === 'string' && typeof invalidReadyGap.cause === 'string',
  'invalid ready-gap attempt must retain its failure phase and cause');
const portableEvidenceSerialized = JSON.stringify({
  desktop,
  slow4g,
  invalidSlow4g,
  delivery,
  readyGap,
  invalidReadyGap,
});
failUnless(!/(?:file:\/\/\/|(?:^|["'(\s])[A-Za-z]:[\\/])/.test(portableEvidenceSerialized),
  'performance evidence must not contain machine-local absolute paths');

// Current blocking and regression evidence is attached to one immutable E5
// deployment. Delivery encoding and the mark/input probe remain explicitly
// historical dc818 diagnostics and are not relabelled as current captures.
failUnless(desktop.deployment?.revision === slow4g.profiles?.after?.revision, 'reports: desktop and Slow 4G E5 revisions differ');
failUnless(desktop.deployment?.url === slow4g.profiles?.after?.url, 'reports: desktop and Slow 4G E5 URLs differ');
failUnless(readyGap.targetRevision === HISTORICAL_DC818_REVISION && readyGap.targetUrl === HISTORICAL_DC818_URL,
  'reports: ready-gap diagnostic must remain labelled with its historical dc818 deployment');
failUnless(delivery.targetUrl === readyGap.targetUrl,
  'reports: historical delivery and ready-gap diagnostics must identify the same dc818 deployment URL');

const result = {
  stage: 'E5',
  specification: 'TZ 2.9 section 7',
  blockingGates: {
    desktop: {
      profile: '10240 kbit/s, 40 ms latency, CPU x1',
      runs: `${desktop.completeRunCount}/${desktop.expectedRunCount}`,
      medianNavigationToSkeletonPaintMs: desktopSkeletonMedian,
      skeletonLimitMs: SKELETON_LIMIT_MS,
      medianNavigationToTrustedEditorReadyMs: desktopReadyMedian,
      editorReadyLimitMs: READY_LIMIT_MS,
      pass: desktopSkeletonMedian <= SKELETON_LIMIT_MS && desktopReadyMedian <= READY_LIMIT_MS,
    },
    deployedFullWire: {
      source: 'current deployed desktop startup runs',
      medianBytes: desktopWireMedian,
      limitBytes: FULL_WIRE_LIMIT_BYTES,
      marginBytes: FULL_WIRE_LIMIT_BYTES - desktopWireMedian,
      pass: desktopWireMedian <= FULL_WIRE_LIMIT_BYTES,
    },
    slow4gReadinessRegression: {
      previousAcceptedE4MedianMs: beforeReadyMedian,
      currentE5MedianMs: afterReadyMedian,
      changePercent: Number(readinessRegressionPercent.toFixed(3)),
      maximumRegressionPercent: SLOW_4G_REGRESSION_LIMIT_PERCENT,
      pass: readinessRegressionPercent <= SLOW_4G_REGRESSION_LIMIT_PERCENT,
    },
  },
  publishedDiagnostics: {
    slow4gAbsoluteThresholds: 'non-blocking',
    slow4gSkeletonComparison: {
      status: 'not-comparable',
      reason: `E4 strict skeleton-at-FCP proof exists in ${strictBeforePaintProofs}/3 runs; E5 has ${strictAfterPaintProofs}/3. No E4 median or delta is claimed.`,
    },
    deployedEncoding: {
      status: 'historical dc818 diagnostic; not relabelled as current-build evidence',
      brotliResponses: `${brotliResponseCount}/54`,
      eagerRequestsPerRun: 18,
      sourceRichRequestsBeforeReadiness: 0,
    },
    sameRunReadyGap: {
      status: 'historical dc818 same-navigation semantic diagnostic; not current-build timing evidence',
      productEditorReadyMarkAtMs: markAt,
      trustedInputAcceptedAtMs: trustedInputAt,
      markToTrustedInputMs: Number(sameRunMarkToInputMs.toFixed(3)),
      verdict: `The sampled same-navigation gap is ${sameRunMarkToInputMs.toFixed(1)} ms. Cross-series or cross-revision endpoint subtraction is intentionally not reported as an application readiness gap.`,
      invalidHarnessAttemptExcluded: invalidReadyGap.validMeasurement === false,
    },
    invalidFreshSlow4gBaselineAttempt: {
      retained: true,
      acceptedAsMeasurement: false,
      currentE5RunsRetained: invalidSlow4g.profiles?.after?.runs?.length,
      reason: invalidSlow4g.exclusionReason,
    },
  },
  failures,
  allPassed: failures.length === 0,
};

console.log(JSON.stringify(result, null, 2));
if (failures.length > 0) process.exitCode = 1;
