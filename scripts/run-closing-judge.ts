/**
 * Manual Gemini check for closing-intent fixtures.
 * Not wired to npm test, npm run build, or CI.
 *
 *   GEMINI_API_KEY=… node --experimental-strip-types --experimental-detect-module scripts/run-closing-judge.ts
 */
import { DEFAULT_MODEL, judgeClosing } from "../lib/gemini.ts";
import { scenarios } from "../lib/scenarios.ts";
import { CLOSING_FIXTURES } from "./closing-fixtures.ts";

const apiKey = process.env.GEMINI_API_KEY?.trim();
if (!apiKey) {
  console.error("Set GEMINI_API_KEY to run this script.");
  process.exit(1);
}

const model = process.env.GEMINI_MODEL?.trim() || DEFAULT_MODEL;

let passed = 0;
let failed = 0;

for (const fixture of CLOSING_FIXTURES) {
  const scenario = scenarios.find((s) => s.id === fixture.scenarioId);
  if (!scenario) {
    console.error(`FAIL  ${fixture.id}  unknown scenario ${fixture.scenarioId}`);
    failed += 1;
    continue;
  }

  const result = await judgeClosing({
    apiKey,
    model,
    endGoal: scenario.endGoal,
    closingIntent: scenario.closingIntent,
    turns: fixture.messages,
  });

  const match =
    result.goal_met === fixture.expect.goal_met &&
    result.closing === fixture.expect.closing;
  const got = `goal_met=${result.goal_met} closing=${result.closing} ok=${result.ok}`;
  const want = `goal_met=${fixture.expect.goal_met} closing=${fixture.expect.closing}`;

  if (match) {
    passed += 1;
    console.log(`PASS  ${fixture.id}  ${got}`);
  } else {
    failed += 1;
    console.error(`FAIL  ${fixture.id}  got ${got}  want ${want}`);
    if (result.error) console.error(`      ${result.error}`);
  }
}

console.log(`${passed} passed, ${failed} failed, ${CLOSING_FIXTURES.length} total`);
process.exit(failed ? 1 : 0);
