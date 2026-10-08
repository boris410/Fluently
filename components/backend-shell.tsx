"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  useSyncExternalStore,
} from "react";
import { ElevenLabsTtsTester } from "@/components/elevenlabs-tts-tester";
import { LogsBody, type LogsPayload } from "@/components/logs-body";
import {
  DevToolsPane,
  GeminiKeyPane,
  TutorVoicePane,
} from "@/components/settings-panel";
import { UsageBody, type UsagePayload } from "@/components/usage-body";
import { VoiceCatalog } from "@/components/voice-catalog";
import {
  IS_DEV,
  type Corner,
  fetchDevToolsConfig,
  hideDevIndicator,
  scaleIdFor,
} from "@/lib/devtools";

type PaneId =
  | "gemini-key"
  | "voice"
  | "usage"
  | "logs"
  | "voices"
  | "tts"
  | "devtools";

const PANES: { id: PaneId; label: string; devOnly?: boolean }[] = [
  { id: "gemini-key", label: "Gemini API key" },
  { id: "voice", label: "家教的聲音" },
  { id: "usage", label: "用量統計" },
  { id: "logs", label: "API 呼叫紀錄" },
  { id: "voices", label: "音色目錄" },
  { id: "tts", label: "TTS測試" },
  { id: "devtools", label: "開發者工具", devOnly: true },
];

const PANE_IDS = new Set<string>(PANES.map((p) => p.id));

function paneFromHash(hash: string): PaneId {
  const id = hash.replace(/^#/, "");
  if (id === "devtools") return IS_DEV ? "devtools" : "gemini-key";
  if (PANE_IDS.has(id) && id !== "devtools") return id as PaneId;
  return "gemini-key";
}

function subscribeHash(onChange: () => void) {
  window.addEventListener("hashchange", onChange);
  return () => window.removeEventListener("hashchange", onChange);
}

function readHashPane(): PaneId {
  return paneFromHash(window.location.hash);
}

export function BackendShell({
  configured,
  voiceId,
}: {
  configured: boolean;
  voiceId: string | null;
}) {
  const pane = useSyncExternalStore(
    subscribeHash,
    readHashPane,
    () => "gemini-key" as PaneId,
  );
  const [corner, setCorner] = useState<Corner>("bottom-left");
  const [scaleId, setScaleId] = useState("medium");
  const [indicatorHidden, setIndicatorHidden] = useState(false);

  const items = useMemo(
    () => PANES.filter((item) => !item.devOnly || IS_DEV),
    [],
  );

  const selectPane = useCallback((id: PaneId) => {
    const next = id === "devtools" && !IS_DEV ? "gemini-key" : id;
    window.history.replaceState(null, "", `/backend#${next}`);
    window.dispatchEvent(new Event("hashchange"));
  }, []);

  useEffect(() => {
    if (!IS_DEV) return;
    let stale = false;
    fetchDevToolsConfig().then((config) => {
      if (stale || !config) return;
      if (config.devToolsPosition) setCorner(config.devToolsPosition);
      setScaleId(scaleIdFor(config.scale));
    });
    return () => {
      stale = true;
    };
  }, []);

  const active = items.find((item) => item.id === pane) ?? items[0];

  return (
    <div className="flex flex-col gap-6 lg:flex-row lg:gap-8">
      <nav
        aria-label="後台"
        className="w-full lg:w-56 lg:shrink-0 lg:border-r lg:border-line/70 lg:pr-6"
      >
        <ul className="flex flex-col gap-0.5">
          {items.map((item) => {
            const current = item.id === pane;
            return (
              <li key={item.id}>
                <button
                  type="button"
                  aria-current={current ? "true" : undefined}
                  onClick={() => selectPane(item.id)}
                  className={`w-full rounded-lg px-3 py-2 text-left text-[13px] transition-colors ${
                    current
                      ? "bg-surface-2 text-ink"
                      : "text-ink-soft hover:bg-surface-2 hover:text-ink"
                  }`}
                >
                  {item.label}
                </button>
              </li>
            );
          })}
        </ul>
      </nav>

      <div className="min-w-0 flex-1">
        <h2 className="font-display text-[28px] sm:text-[32px]">
          {active.label}
        </h2>
        <PaneBody
          pane={pane}
          configured={configured}
          voiceId={voiceId}
          onOpenVoiceCatalog={() => selectPane("voices")}
          corner={corner}
          scaleId={scaleId}
          indicatorHidden={indicatorHidden}
          onCorner={setCorner}
          onScaleId={setScaleId}
          onHideIndicator={() => {
            setIndicatorHidden(true);
            void hideDevIndicator();
          }}
        />
      </div>
    </div>
  );
}

function PaneBody({
  pane,
  configured,
  voiceId,
  onOpenVoiceCatalog,
  corner,
  scaleId,
  indicatorHidden,
  onCorner,
  onScaleId,
  onHideIndicator,
}: {
  pane: PaneId;
  configured: boolean;
  voiceId: string | null;
  onOpenVoiceCatalog: () => void;
  corner: Corner;
  scaleId: string;
  indicatorHidden: boolean;
  onCorner: (corner: Corner) => void;
  onScaleId: (id: string) => void;
  onHideIndicator: () => void;
}) {
  if (pane === "gemini-key") {
    return (
      <div className="mt-6">
        <GeminiKeyPane />
      </div>
    );
  }
  if (pane === "voice") {
    return (
      <div className="mt-6">
        <TutorVoicePane />
      </div>
    );
  }
  if (pane === "usage") return <UsagePane />;
  if (pane === "logs") return <LogsPane />;
  if (pane === "voices") return <VoicesPane />;
  if (pane === "tts") {
    return (
      <div className="max-w-3xl">
        <PaneLead>
          測試介面。Key 只存在伺服器的
          <code className="mx-1 font-mono text-[14px]">.env.local</code>
          ，瀏覽器打的是我們自己的
          <code className="mx-1 font-mono text-[14px]">/api/elevenlabs</code>
          ，不會把 key 送到前端。音色從資料庫讀，請到音色目錄管理。
        </PaneLead>
        <div className="mt-10">
          <ElevenLabsTtsTester
            configured={configured}
            voiceId={voiceId}
            onOpenVoiceCatalog={onOpenVoiceCatalog}
          />
        </div>
      </div>
    );
  }
  if (pane === "devtools" && IS_DEV) {
    return (
      <div className="mt-6">
        <DevToolsPane
          corner={corner}
          scaleId={scaleId}
          indicatorHidden={indicatorHidden}
          onCorner={onCorner}
          onScaleId={onScaleId}
          onHideIndicator={onHideIndicator}
        />
      </div>
    );
  }
  return <GeminiKeyPane />;
}

function PaneLead({ children }: { children: React.ReactNode }) {
  return (
    <p className="mt-3 max-w-2xl text-[16px] leading-7 text-ink-soft">
      {children}
    </p>
  );
}

function StatusLine({ children }: { children: React.ReactNode }) {
  return <p className="mt-6 text-[13px] text-ink-muted">{children}</p>;
}

async function readApiError(res: Response): Promise<string> {
  const data = (await res.json().catch(() => null)) as { error?: string } | null;
  return data?.error ?? "無法連線到伺服器";
}

const NETWORK_ERROR = "無法連線到伺服器";

type JsonResult<T> = { ok: true; data: T } | { ok: false; error: string };

async function fetchJson<T>(input: string): Promise<JsonResult<T>> {
  let res: Response;
  try {
    res = await fetch(input);
  } catch {
    return { ok: false, error: NETWORK_ERROR };
  }
  if (!res.ok) {
    return { ok: false, error: await readApiError(res) };
  }
  try {
    return { ok: true, data: (await res.json()) as T };
  } catch {
    return { ok: false, error: NETWORK_ERROR };
  }
}

function UsagePane() {
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<UsagePayload | null>(null);

  useEffect(() => {
    let stale = false;
    fetchJson<UsagePayload>("/api/usage").then((result) => {
      if (stale) return;
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setData(result.data);
    });
    return () => {
      stale = true;
    };
  }, []);

  return (
    <>
      <PaneLead>
        每一次送出到 Gemini 的來回都記在你的帳號，token 數字取自 API 回傳的{" "}
        <code className="font-mono text-[14px]">usageMetadata</code>
        ，不是估算值。
      </PaneLead>
      {error ? (
        <StatusLine>{error}</StatusLine>
      ) : !data ? (
        <StatusLine>載入中…</StatusLine>
      ) : (
        <UsageBody
          totals={data.totals}
          chat={data.chat}
          tts={data.tts}
          byScenario={data.byScenario}
          sessions={data.sessions}
          daily={data.daily}
          scenarios={data.scenarios}
        />
      )}
    </>
  );
}

function LogsPane() {
  const [op, setOp] = useState<string | undefined>();
  const [status, setStatus] = useState<"ok" | "failed" | undefined>();
  const [q, setQ] = useState("");
  const [qDraft, setQDraft] = useState("");
  const [page, setPage] = useState(1);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<LogsPayload | null>(null);
  const requestKey = `${op ?? ""}|${status ?? ""}|${q}|${page}`;
  const [resultKey, setResultKey] = useState<string | null>(null);

  useEffect(() => {
    let stale = false;
    const params = new URLSearchParams();
    if (op) params.set("op", op);
    if (status) params.set("status", status);
    if (q) params.set("q", q);
    if (page > 1) params.set("page", String(page));
    const query = params.toString();
    fetchJson<LogsPayload>(query ? `/api/logs?${query}` : "/api/logs").then(
      (result) => {
        if (stale) return;
        setResultKey(requestKey);
        if (!result.ok) {
          setData(null);
          setError(result.error);
          return;
        }
        setError(null);
        setData(result.data);
      },
    );
    return () => {
      stale = true;
    };
  }, [op, status, q, page, requestKey]);

  return (
    <>
      <PaneLead>
        <code className="font-mono text-[14px]">api_logs</code>{" "}
        表的內容：每一次對外呼叫的平台、模型、送出與收到的實際內容、HTTP
        狀態碼與耗時。點任一列可以展開全文。
      </PaneLead>
      {error && resultKey === requestKey ? (
        <StatusLine>{error}</StatusLine>
      ) : resultKey !== requestKey || !data ? (
        <StatusLine>載入中…</StatusLine>
      ) : data ? (
        <LogsBody
          logs={data.logs}
          total={data.total}
          grandTotal={data.grandTotal}
          page={data.page}
          pages={data.pages}
          summary={data.summary}
          toolbar={
            data.grandTotal > 0 ? (
              <div className="mt-6 flex flex-col gap-3 border-y border-line py-4 sm:flex-row sm:items-center">
                <FilterGroup label="操作">
                  <PillButton
                    active={!op}
                    onClick={() => {
                      setOp(undefined);
                      setPage(1);
                    }}
                  >
                    全部
                  </PillButton>
                  {data.operations.map((item) => (
                    <PillButton
                      key={item}
                      active={op === item}
                      onClick={() => {
                        setOp(item);
                        setPage(1);
                      }}
                    >
                      {item}
                    </PillButton>
                  ))}
                </FilterGroup>

                <FilterGroup label="狀態">
                  <PillButton
                    active={!status}
                    onClick={() => {
                      setStatus(undefined);
                      setPage(1);
                    }}
                  >
                    全部
                  </PillButton>
                  <PillButton
                    active={status === "ok"}
                    onClick={() => {
                      setStatus("ok");
                      setPage(1);
                    }}
                  >
                    成功
                  </PillButton>
                  <PillButton
                    active={status === "failed"}
                    onClick={() => {
                      setStatus("failed");
                      setPage(1);
                    }}
                  >
                    失敗
                  </PillButton>
                </FilterGroup>

                <form
                  className="flex gap-2 sm:ml-auto"
                  onSubmit={(e) => {
                    e.preventDefault();
                    setQ(qDraft.trim());
                    setPage(1);
                  }}
                >
                  <input
                    type="search"
                    value={qDraft}
                    onChange={(e) => setQDraft(e.target.value)}
                    placeholder="搜尋內容或模型"
                    className="w-full rounded-lg border border-line bg-surface px-3 py-2 text-[13px] text-ink placeholder:text-ink-muted focus:border-line-strong focus:outline-none sm:w-56"
                  />
                  <button
                    type="submit"
                    className="shrink-0 rounded-lg border border-line-strong px-3 py-2 text-[13px] text-ink transition-colors hover:border-clay hover:text-clay"
                  >
                    搜尋
                  </button>
                </form>
              </div>
            ) : null
          }
          pagination={
            <div className="mt-6 flex items-center justify-between">
              <PageButton
                disabled={data.page <= 1}
                onClick={() => setPage(data.page - 1)}
              >
                ← 上一頁
              </PageButton>
              <span className="font-mono text-[13px] text-ink-muted">
                {data.page} / {data.pages}
              </span>
              <PageButton
                disabled={data.page >= data.pages}
                onClick={() => setPage(data.page + 1)}
              >
                下一頁 →
              </PageButton>
            </div>
          }
        />
      ) : null}
    </>
  );
}

function VoicesPane() {
  const [error, setError] = useState<string | null>(null);
  const [voices, setVoices] = useState<
    { id: string; voiceId: string; label: string; isFree: boolean }[] | null
  >(null);
  const [characters, setCharacters] = useState<
    { id: string; name: string; elevenlabsVoiceId: string }[] | null
  >(null);

  useEffect(() => {
    let stale = false;
    Promise.all([
      fetchJson<{
        voices?: { id: string; voiceId: string; label: string; isFree: boolean }[];
      }>("/api/voices"),
      fetchJson<{
        characters?: {
          id: string;
          name: string;
          elevenlabsVoiceId: string;
        }[];
      }>("/api/characters"),
    ]).then(([voicesRes, charactersRes]) => {
      if (stale) return;
      if (!voicesRes.ok) {
        setError(voicesRes.error);
        return;
      }
      if (!charactersRes.ok) {
        setError(charactersRes.error);
        return;
      }
      setVoices(voicesRes.data.voices ?? []);
      setCharacters(charactersRes.data.characters ?? []);
    });
    return () => {
      stale = true;
    };
  }, []);

  return (
    <div className="max-w-3xl">
      <PaneLead>
        全域的 ElevenLabs 音色與人物指派。登入者看到的是同一份目錄，改了會影響之後所有練習的角色聲音。
      </PaneLead>
      {error ? (
        <StatusLine>{error}</StatusLine>
      ) : voices === null || characters === null ? (
        <StatusLine>載入中…</StatusLine>
      ) : (
        <div className="mt-10">
          <VoiceCatalog
            initialVoices={voices}
            initialCharacters={characters}
          />
        </div>
      )}
    </div>
  );
}

function FilterGroup({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-[12px] text-ink-muted">{label}</span>
      <div className="flex flex-wrap gap-1.5">{children}</div>
    </div>
  );
}

function PillButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full border px-3 py-1.5 text-[13px] transition-colors ${
        active
          ? "border-clay bg-clay text-on-clay"
          : "border-line bg-surface text-ink-soft hover:border-line-strong hover:text-ink"
      }`}
    >
      {children}
    </button>
  );
}

function PageButton({
  disabled,
  onClick,
  children,
}: {
  disabled: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  if (disabled) {
    return (
      <span className="rounded-full border border-line px-4 py-2 text-[13px] text-ink-muted opacity-50">
        {children}
      </span>
    );
  }
  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded-full border border-line-strong px-4 py-2 text-[13px] text-ink transition-colors hover:border-clay hover:text-clay"
    >
      {children}
    </button>
  );
}
