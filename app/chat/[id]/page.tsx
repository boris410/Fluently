import Link from "next/link";
import { notFound } from "next/navigation";
import { ChatRoom } from "@/components/chat-room";
import { LiveRoom } from "@/components/live-room";
import { ModePicker } from "@/components/mode-picker";
import { SettingsMenu } from "@/components/settings-menu";
import { getHistory, getSessionStats, sessionExists } from "@/lib/db";
import { LEVELS, getScenario } from "@/lib/scenarios";
import type { ChatTurn } from "@/lib/use-conversation";

export async function generateMetadata(props: PageProps<"/chat/[id]">) {
  const { id } = await props.params;
  const scenario = getScenario(id);
  return { title: scenario ? `${scenario.title} — Fluently` : "Fluently" };
}

export default async function ChatPage(props: PageProps<"/chat/[id]">) {
  const { id } = await props.params;
  const scenario = getScenario(id);
  if (!scenario) notFound();

  const level = LEVELS.find((l) => l.id === scenario.level)!;
  const { session, mode: modeParam } = await props.searchParams;

  // `?session=<id>` resumes an earlier conversation from the database.
  const resumeId =
    typeof session === "string" && sessionExists(session) ? session : null;

  // No mode yet and nothing to resume — let the learner choose one first.
  // Resuming always lands in the transcript, which is the point of resuming.
  const mode =
    modeParam === "live" ? "live" : modeParam === "script" || resumeId ? "script" : null;

  const turns: ChatTurn[] = resumeId
    ? getHistory(resumeId).map((m) => ({
        id: `m${m.id}`,
        role: m.role,
        text: m.content,
      }))
    : [{ id: "opening", role: "model", text: scenario.opening }];

  const stats = resumeId
    ? (() => {
        const s = getSessionStats(resumeId);
        return {
          calls: s.calls,
          promptTokens: s.prompt_tokens,
          outputTokens: s.output_tokens,
          totalTokens: s.total_tokens,
        };
      })()
    : { calls: 0, promptTokens: 0, outputTokens: 0, totalTokens: 0 };

  return (
    <div className="flex min-h-full flex-1 flex-col">
      <header className="sticky top-0 z-30 border-b border-line/70 bg-canvas/80 px-5 backdrop-blur-md sm:px-8">
        <div className="mx-auto flex h-16 w-full max-w-3xl items-center gap-3">
          <Link
            href="/scenarios"
            className="rounded-lg px-2 py-1.5 text-[14px] text-ink-muted transition-colors hover:bg-surface-2 hover:text-ink"
          >
            ←
          </Link>
          <span
            className="tinted flex h-9 w-9 items-center justify-center rounded-lg text-[18px]"
            style={
              {
                "--tint-light": scenario.tint[0],
                "--tint-dark": scenario.tint[1],
              } as React.CSSProperties
            }
          >
            {scenario.emoji}
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate font-display text-[16px] leading-tight tracking-tight">
              {scenario.title}
            </p>
            <p className="truncate text-[12px] text-ink-muted">
              {mode === "live" ? (
                "真實情境"
              ) : (
                <>
                  {scenario.titleZh} · {level.label}
                  {resumeId && " · 續接上次對話"}
                </>
              )}
            </p>
          </div>
          <SettingsMenu />
        </div>
      </header>

      {mode === null && <ModePicker scenario={scenario} />}

      {mode === "live" && (
        <LiveRoom
          scenario={scenario}
          initialTurns={turns}
          initialSessionId={resumeId}
          initialStats={stats}
        />
      )}

      {mode === "script" && (
        <ChatRoom
          scenario={scenario}
          initialTurns={turns}
          initialSessionId={resumeId}
          initialStats={stats}
        />
      )}
    </div>
  );
}
