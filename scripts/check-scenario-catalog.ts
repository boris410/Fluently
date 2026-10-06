import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import { decideWrapUp, parseJudgeFlags } from "../lib/gemini.ts";
import { MAX_USER_TURNS, scenarios } from "../lib/scenarios.ts";
import { CLOSING_FIXTURES } from "./closing-fixtures.ts";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

const PUBLIC_IDS = [
  "cafe",
  "directions",
  "small-talk",
  "hotel",
  "clinic",
  "phone-interview",
  "interview",
  "debate",
] as const;

const END_GOALS: Record<(typeof PUBLIC_IDS)[number], string> = {
  cafe: "The scene goal is met when the learner has ordered a drink and you have confirmed the size and options or given the price.",
  directions:
    "The scene goal is met when the learner has given a usable route, and you (the asker) have thanked them and are leaving.",
  "small-talk":
    "The scene goal is met when you have chatted and one of you is ending the conversation politely.",
  hotel: "The scene goal is met when check-in details are done and the guest has a key or a room number.",
  clinic:
    "The scene goal is met when the learner has described their symptoms and you have given advice or a next step.",
  "phone-interview":
    "The scene goal is met when you (the recruiter) are wrapping up the call or have said you will follow up.",
  interview:
    "The scene goal is met when the interview questions are done and either the learner has asked something back or you have said you will be in touch.",
  debate:
    "The scene goal is met when both sides have made their case and the conversation is wrapping up.",
};

const CLOSING_INTENTS: Record<(typeof PUBLIC_IDS)[number], string> = {
  cafe: "The order is settled and either person shows the interaction is finished, such as thanking, saying they will wait or find a seat, saying they are leaving, or wishing each other well. Stating the price or confirming the order alone is not a closing.",
  directions:
    "The asker shows they understood and are moving on, such as thanking, repeating the route and saying they will go, saying where they are heading next, or saying goodbye.",
  "small-talk":
    "Either person shows the chat is winding down, such as saying they need to go, mentioning something else they have to do, saying it was nice talking, or making a final friendly remark. A short pause or a short reply is not a closing.",
  hotel:
    "The check-in is complete and either person shows it is finished, such as acknowledging the key or room number, saying they will go up to the room, thanking, or saying something like enjoy your stay.",
  clinic:
    "The advice is understood and either person shows the visit is finished, such as confirming what to do, saying they will follow the advice, thanking, or the doctor saying to come back if it does not get better and the learner agreeing.",
  "phone-interview":
    "The recruiter starts wrapping up, such as explaining next steps, saying they will follow up, asking if there are any final questions, and the learner has nothing more to add, thanks them, or says goodbye.",
  interview:
    "The interview moves into its last part, such as final questions from both sides, next steps, saying they will be in touch, thanking each other, or saying there is nothing more to add.",
  debate:
    "Both sides have made their points and either side wraps up, such as summing up a final point, acknowledging the other side, agreeing to disagree, saying there is nothing more to add, or ending politely. One side going quiet for a moment is not a closing.",
};

function parseUpdates(sql: string, column: string): Map<string, string> {
  const re = new RegExp(
    `UPDATE scenarios SET ${column} = '((?:[^']|'')*)' WHERE id = '([^']+)';`,
    "g",
  );
  const out = new Map<string, string>();
  for (const match of sql.matchAll(re)) {
    out.set(match[2], match[1].replaceAll("''", "'"));
  }
  return out;
}

describe("scenario catalog", () => {
  it("exports exactly the eight public ids", () => {
    assert.deepEqual(
      scenarios.map((s) => s.id),
      [...PUBLIC_IDS],
    );
  });

  it("does not add a ninth scenario", () => {
    assert.equal(scenarios.length, 8);
  });

  it("keeps MAX_USER_TURNS at 12", () => {
    assert.equal(MAX_USER_TURNS, 12);
  });

  it("has non-empty endGoal and closingIntent on every public scenario", () => {
    for (const scenario of scenarios) {
      assert.ok(scenario.endGoal.trim(), `${scenario.id} endGoal is empty`);
      assert.ok(
        scenario.closingIntent.trim(),
        `${scenario.id} closingIntent is empty`,
      );
    }
  });

  it("matches the spec endGoal copy byte-for-byte", () => {
    for (const id of PUBLIC_IDS) {
      const scenario = scenarios.find((s) => s.id === id);
      assert.ok(scenario, `missing ${id}`);
      assert.equal(scenario.endGoal, END_GOALS[id], id);
    }
  });

  it("matches the spec closingIntent copy byte-for-byte", () => {
    for (const id of PUBLIC_IDS) {
      const scenario = scenarios.find((s) => s.id === id);
      assert.ok(scenario, `missing ${id}`);
      assert.equal(scenario.closingIntent, CLOSING_INTENTS[id], id);
    }
  });

  it("matches 0007 end_goal to TypeScript endGoal byte-for-byte", () => {
    const sql = readFileSync(
      join(ROOT, "migrations/0007_scenario_end_goal.sql"),
      "utf8",
    );
    const updates = parseUpdates(sql, "end_goal");
    assert.deepEqual([...updates.keys()].sort(), [...PUBLIC_IDS].sort());
    for (const scenario of scenarios) {
      assert.equal(updates.get(scenario.id), scenario.endGoal, scenario.id);
    }
  });

  it("matches 0008 closing_intent to TypeScript closingIntent byte-for-byte", () => {
    const sql = readFileSync(
      join(ROOT, "migrations/0008_scenario_closing_intent.sql"),
      "utf8",
    );
    const updates = parseUpdates(sql, "closing_intent");
    assert.deepEqual([...updates.keys()].sort(), [...PUBLIC_IDS].sort());
    for (const scenario of scenarios) {
      assert.equal(updates.get(scenario.id), scenario.closingIntent, scenario.id);
    }
  });

    it("has 3–4 judge fixtures per public scenario", () => {
      for (const id of PUBLIC_IDS) {
        const rows = CLOSING_FIXTURES.filter((f) => f.scenarioId === id);
        assert.ok(rows.length >= 3 && rows.length <= 4, `${id} has ${rows.length}`);
        for (const row of rows) {
          assert.ok(row.messages.length > 0 && row.messages.length <= 6, row.id);
          assert.equal(row.messages.at(-1)?.role, "user", row.id);
        }
      }
    });
  });

describe("judge parse and wrap-up matrix", () => {
  it("zeros both flags when either field is missing or not boolean", () => {
    assert.deepEqual(parseJudgeFlags({ closing: true }), {
      goal_met: false,
      closing: false,
      valid: false,
    });
    assert.deepEqual(parseJudgeFlags({ goal_met: true }), {
      goal_met: false,
      closing: false,
      valid: false,
    });
    assert.deepEqual(parseJudgeFlags({ goal_met: "true", closing: true }), {
      goal_met: false,
      closing: false,
      valid: false,
    });
  });

  it("keeps independent booleans when both fields are valid", () => {
    assert.deepEqual(parseJudgeFlags({ goal_met: false, closing: true }), {
      goal_met: false,
      closing: true,
      valid: true,
    });
  });

  it("maps the server decision matrix", () => {
    assert.deepEqual(decideWrapUp({ goal_met: true, closing: true }, 12), {
      wrapUp: { outcome: "completed" },
      closingTurn: true,
    });
    assert.deepEqual(decideWrapUp({ goal_met: true, closing: false }, 3), {
      wrapUp: null,
      closingTurn: false,
    });
    assert.deepEqual(decideWrapUp({ goal_met: false, closing: true }, 2), {
      wrapUp: { outcome: "incomplete" },
      closingTurn: true,
    });
    assert.deepEqual(decideWrapUp({ goal_met: false, closing: false }, 3), {
      wrapUp: null,
      closingTurn: false,
    });
    assert.deepEqual(decideWrapUp({ goal_met: false, closing: false }, 12), {
      wrapUp: { outcome: "incomplete" },
      closingTurn: true,
    });
    assert.deepEqual(decideWrapUp({ goal_met: true, closing: false }, 12), {
      wrapUp: { outcome: "incomplete" },
      closingTurn: true,
    });
  });
});
