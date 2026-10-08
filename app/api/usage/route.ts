import { getCurrentUser } from "@/lib/current-user";
import {
  type DailyUsage,
  type LogSummary,
  type ScenarioUsage,
  type SessionSummary,
  type UsageTotals,
  countLogs,
  getDailyUsage,
  getLogSummary,
  getRecentSessions,
  getScenario,
  getTotals,
  getUsageByScenario,
} from "@/lib/db";

const UNAUTH = { error: "請先登入" };
const READ_FAIL = { error: "無法讀取用量" };
const DAYS = 14;

function totalsToJson(row: UsageTotals) {
  return {
    calls: row.calls,
    sessions: row.sessions,
    promptTokens: row.prompt_tokens,
    outputTokens: row.output_tokens,
    thoughtTokens: row.thought_tokens,
    totalTokens: row.total_tokens,
    avgLatency: row.avg_latency,
    failures: row.failures,
  };
}

function scenarioUsageToJson(row: ScenarioUsage) {
  return {
    scenarioId: row.scenario_id,
    calls: row.calls,
    sessions: row.sessions,
    totalTokens: row.total_tokens,
    promptTokens: row.prompt_tokens,
    outputTokens: row.output_tokens,
  };
}

function sessionToJson(row: SessionSummary) {
  return {
    id: row.id,
    scenarioId: row.scenario_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    turns: row.turns,
    totalTokens: row.total_tokens,
  };
}

function logSummaryToJson(row: LogSummary) {
  return {
    operation: row.operation,
    platform: row.platform,
    calls: row.calls,
    failures: row.failures,
    avgMs: row.avg_ms,
    totalTokens: row.total_tokens,
  };
}

function dailyToJson(row: DailyUsage) {
  return {
    day: row.day,
    calls: row.calls,
    totalTokens: row.total_tokens,
  };
}

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return Response.json(UNAUTH, { status: 401 });

  try {
    const [totals, chat, tts, byScenario, sessions, logCount, logSummary, daily] =
      await Promise.all([
        getTotals(user.id),
        getTotals(user.id, "chat"),
        getTotals(user.id, "tts"),
        getUsageByScenario(user.id),
        getRecentSessions(user.id),
        countLogs(user.id, {}),
        getLogSummary(user.id),
        getDailyUsage(user.id, DAYS),
      ]);

    const scenarioIds = Array.from(
      new Set([
        ...byScenario.map((row) => row.scenario_id),
        ...sessions.map((row) => row.scenario_id),
      ]),
    );
    const scenarios = (
      await Promise.all(scenarioIds.map((id) => getScenario(id)))
    ).flatMap((scenario) =>
      scenario
        ? [
            {
              id: scenario.id,
              emoji: scenario.emoji,
              title: scenario.title,
              titleZh: scenario.titleZh,
            },
          ]
        : [],
    );

    return Response.json({
      totals: totalsToJson(totals),
      chat: totalsToJson(chat),
      tts: totalsToJson(tts),
      byScenario: byScenario.map(scenarioUsageToJson),
      sessions: sessions.map(sessionToJson),
      logCount,
      logSummary: logSummary.map(logSummaryToJson),
      daily: daily.map(dailyToJson),
      scenarios,
    });
  } catch (error) {
    console.error("[api/usage] 讀取失敗：", error);
    return Response.json(READ_FAIL, { status: 500 });
  }
}
