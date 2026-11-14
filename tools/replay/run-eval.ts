import { replayAttempts, syntheticAttempts, REPLAY_TOOL_VERSION } from './src/index.js';

console.log(`@aptiva/replay v${REPLAY_TOOL_VERSION} Evaluation`);
// Generate 10 topics with 100 attempts each = 1,000 attempts
const attempts = syntheticAttempts(10, 100);
const report = replayAttempts(attempts);

console.log(`----------------------------------------`);
console.log(`Replay Evaluation Results:`);
console.log(`Total Attempts:    ${report.attempts}`);
console.log(`Total Topics:      ${report.topics}`);
console.log(`Log Loss:          ${report.logLoss.toFixed(4)}`);
console.log(`Brier Score:       ${report.brier.toFixed(4)}`);
console.log(`Mean Abs Error:    ${report.meanAbsError.toFixed(4)}`);
console.log(`Interval Coverage: ${(report.intervalCoverage * 100).toFixed(2)}%`);
console.log(`----------------------------------------`);
