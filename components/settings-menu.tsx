"use client";

import Link from "next/link";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import {
  CORNERS,
  IS_DEV,
  SCALES,
  type Corner,
  fetchDevToolsConfig,
  hideDevIndicator,
  patchDevToolsConfig,
  scaleIdFor,
} from "@/lib/devtools";
import {
  THEMES,
  type Theme,
  applyTheme,
  readStoredTheme,
  storeTheme,
} from "@/lib/theme";
import {
  type VoiceSource,
  getApiKey,
  getAutoSpeak,
  getVoiceName,
  getVoiceSource,
  setApiKey,
  setAutoSpeak,
  setVoiceName,
  setVoiceSource,
} from "@/lib/settings";
import { VOICES } from "@/lib/gemini";
import { canSpeak } from "@/lib/speech";

export function SettingsMenu() {
  const [open, setOpen] = useState(false);
  const [theme, setTheme] = useState<Theme>(() => readStoredTheme());
  const [corner, setCorner] = useState<Corner>("bottom-left");
  const [scaleId, setScaleId] = useState("medium");
  const [indicatorHidden, setIndicatorHidden] = useState(false);
  const [keyDraft, setKeyDraft] = useState("");
  const [keyStatus, setKeyStatus] = useState<
    "idle" | "checking" | "ok" | "bad"
  >("idle");
  const [keyMessage, setKeyMessage] = useState("");
  const [autoSpeak, setAutoSpeakState] = useState(true);
  const [voiceSource, setVoiceSourceState] = useState<VoiceSource>("browser");
  const [voiceName, setVoiceNameState] = useState(VOICES[0].id);
  const wrapRef = useRef<HTMLDivElement>(null);

  // React clears <html> attributes on the Strict Mode dev remount, which
  // drops what the inline script set. Re-apply before paint. No-op in prod.
  useLayoutEffect(() => {
    applyTheme(readStoredTheme());
  }, []);

  // Reading stored preferences belongs in the event handler that opens the
  // panel — an effect would fire a cascading render on every open.
  const togglePanel = useCallback(() => {
    if (!open) {
      setKeyDraft(getApiKey());
      setAutoSpeakState(getAutoSpeak());
      setVoiceSourceState(getVoiceSource());
      setVoiceNameState(getVoiceName());
      setKeyStatus("idle");
      setKeyMessage("");
    }
    setOpen(!open);
  }, [open]);

  const saveKey = useCallback(async () => {
    setApiKey(keyDraft);
    if (!keyDraft.trim()) {
      setKeyStatus("idle");
      setKeyMessage("已清除");
      return;
    }
    setKeyStatus("checking");
    setKeyMessage("");
    try {
      const res = await fetch("/api/key-check", {
        method: "POST",
        headers: { "x-gemini-key": keyDraft.trim() },
      });
      const data = await res.json();
      setKeyStatus(data.ok ? "ok" : "bad");
      setKeyMessage(data.ok ? "已驗證，可以開始對話" : (data.message ?? "驗證失敗"));
    } catch {
      setKeyStatus("bad");
      setKeyMessage("無法連線到伺服器");
    }
  }, [keyDraft]);

  // Pull the DevTools indicator's real state when the panel opens.
  useEffect(() => {
    if (!open || !IS_DEV) return;
    let stale = false;
    fetchDevToolsConfig().then((config) => {
      if (stale || !config) return;
      if (config.devToolsPosition) setCorner(config.devToolsPosition);
      setScaleId(scaleIdFor(config.scale));
    });
    return () => {
      stale = true;
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: MouseEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  const pickTheme = useCallback((next: Theme) => {
    setTheme(next);
    storeTheme(next);
    applyTheme(next);
    // Keep the Next.js DevTools overlay in the same theme as the app.
    void patchDevToolsConfig({ theme: next });
  }, []);

  return (
    <div ref={wrapRef} className="relative">
      <button
        type="button"
        onClick={togglePanel}
        aria-expanded={open}
        aria-haspopup="dialog"
        aria-label="設定"
        className={`flex h-9 w-9 items-center justify-center rounded-lg transition-colors ${
          open
            ? "bg-surface-2 text-ink"
            : "text-ink-soft hover:bg-surface-2 hover:text-ink"
        }`}
      >
        <GearIcon />
      </button>

      {open && (
        <div
          role="dialog"
          aria-label="設定"
          className="pop absolute right-0 top-full z-40 mt-2 w-[320px] rounded-2xl border border-line bg-surface p-4 shadow-[var(--shadow)]"
        >
          <Section label="Gemini API key">
            <div className="flex gap-2">
              <input
                type="password"
                value={keyDraft}
                onChange={(e) => {
                  setKeyDraft(e.target.value);
                  setKeyStatus("idle");
                  setKeyMessage("");
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter") void saveKey();
                }}
                placeholder="AIza…"
                autoComplete="off"
                spellCheck={false}
                className="min-w-0 flex-1 rounded-lg border border-line bg-surface-2 px-2.5 py-2 font-mono text-[13px] text-ink placeholder:text-ink-muted focus:border-line-strong focus:outline-none"
              />
              <button
                type="button"
                onClick={() => void saveKey()}
                disabled={keyStatus === "checking"}
                className="shrink-0 rounded-lg bg-clay px-3 py-2 text-[13px] font-medium text-on-clay transition-opacity hover:opacity-90 disabled:opacity-50"
              >
                {keyStatus === "checking" ? "驗證中" : "儲存"}
              </button>
            </div>
            <p className="mt-2 text-[12px] leading-5 text-ink-muted">
              {keyMessage ? (
                <span
                  className={
                    keyStatus === "ok"
                      ? "text-clay"
                      : keyStatus === "bad"
                        ? "text-ink"
                        : undefined
                  }
                >
                  {keyStatus === "ok" ? "✓ " : keyStatus === "bad" ? "✗ " : ""}
                  {keyMessage}
                </span>
              ) : (
                <>
                  只存在這個瀏覽器，不會寫進資料庫。
                  <a
                    href="https://aistudio.google.com/apikey"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="ml-1 text-clay underline underline-offset-2"
                  >
                    申請 key
                  </a>
                </>
              )}
            </p>
          </Section>

          <Section label="家教的聲音">
            <Segmented
              options={[
                { id: "browser", label: "瀏覽器語音" },
                { id: "gemini", label: "Gemini 語音" },
              ]}
              value={voiceSource}
              onSelect={(id) => {
                setVoiceSourceState(id as VoiceSource);
                setVoiceSource(id as VoiceSource);
              }}
            />

            {voiceSource === "gemini" ? (
              <>
                <select
                  value={voiceName}
                  onChange={(e) => {
                    setVoiceNameState(e.target.value);
                    setVoiceName(e.target.value);
                  }}
                  className="mt-2 w-full rounded-lg border border-line bg-surface-2 px-2.5 py-2 text-[13px] text-ink focus:border-line-strong focus:outline-none"
                >
                  {VOICES.map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.id} · {v.style}
                    </option>
                  ))}
                </select>
                <p className="mt-2 text-[12px] leading-5 text-ink-muted">
                  真人感語音，會消耗音訊 token（已計入用量）。同一句話重播不會重新產生，
                  失敗時自動退回瀏覽器語音。
                </p>
              </>
            ) : (
              <p className="mt-2 text-[12px] leading-5 text-ink-muted">
                預設。使用系統內建語音：免費、即時、不耗額度，但聽起來比較機械。
              </p>
            )}

            <button
              type="button"
              onClick={() => {
                const next = !autoSpeak;
                setAutoSpeakState(next);
                setAutoSpeak(next);
              }}
              aria-pressed={autoSpeak}
              className="mt-2 flex w-full items-center justify-between rounded-lg border border-line px-3 py-2 text-[13px] text-ink-soft transition-colors hover:border-line-strong"
            >
              自動朗讀家教回覆
              <span
                className={`flex h-5 w-9 items-center rounded-full p-0.5 transition-colors ${
                  autoSpeak ? "bg-clay" : "bg-line-strong"
                }`}
              >
                <span
                  className={`h-4 w-4 rounded-full bg-surface transition-transform ${
                    autoSpeak ? "translate-x-4" : ""
                  }`}
                />
              </span>
            </button>

            {voiceSource === "browser" && !canSpeak() && (
              <p className="mt-2 text-[12px] text-ink-muted">
                此瀏覽器不支援語音合成，回覆只會以文字顯示。
              </p>
            )}
          </Section>

          <Section label="外觀">
            <Segmented
              options={THEMES.map((t) => ({ id: t.id, label: t.label }))}
              value={theme}
              onSelect={(id) => pickTheme(id as Theme)}
            />
          </Section>

          <Link
            href="/usage"
            onClick={() => setOpen(false)}
            className="mt-1 flex items-center justify-between rounded-lg px-1 py-2 text-[13px] text-ink-soft transition-colors hover:text-ink"
          >
            用量統計
            <span aria-hidden>→</span>
          </Link>
          <Link
            href="/logs"
            onClick={() => setOpen(false)}
            className="flex items-center justify-between rounded-lg px-1 py-2 text-[13px] text-ink-soft transition-colors hover:text-ink"
          >
            API 呼叫紀錄
            <span aria-hidden>→</span>
          </Link>

          {IS_DEV && (
            <>
              <hr className="my-4 border-line" />

              <p className="mb-3 flex items-center gap-1.5 text-[12px] text-ink-muted">
                <span className="h-1.5 w-1.5 rounded-full bg-clay" />
                Next.js 開發者工具
                <span className="ml-auto rounded bg-surface-2 px-1.5 py-0.5 font-mono text-[11px]">
                  dev only
                </span>
              </p>

              <Section label="指示器位置">
                <Segmented
                  options={CORNERS}
                  value={corner}
                  onSelect={(id) => {
                    setCorner(id as Corner);
                    void patchDevToolsConfig({ devToolsPosition: id as Corner });
                  }}
                />
              </Section>

              <Section label="指示器大小">
                <Segmented
                  options={SCALES.map((s) => ({ id: s.id, label: s.label }))}
                  value={scaleId}
                  onSelect={(id) => {
                    setScaleId(id);
                    const scale = SCALES.find((s) => s.id === id)?.value;
                    if (scale) void patchDevToolsConfig({ scale });
                  }}
                />
              </Section>

              <button
                type="button"
                disabled={indicatorHidden}
                onClick={() => {
                  setIndicatorHidden(true);
                  void hideDevIndicator();
                }}
                className="mt-3 w-full rounded-lg border border-line px-3 py-2 text-[13px] text-ink-soft transition-colors hover:border-line-strong hover:text-ink disabled:cursor-not-allowed disabled:opacity-50"
              >
                {indicatorHidden ? "已隱藏（重新整理生效）" : "隱藏指示器 24 小時"}
              </button>
              <p className="mt-2 text-[12px] leading-5 text-ink-muted">
                隱藏狀態只存在 dev server 記憶體，沒有還原用的端點——
                重啟 <code className="font-mono">npm run dev</code> 即可叫回來。
              </p>
            </>
          )}
        </div>
      )}
    </div>
  );
}

function Section({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="mb-3 last:mb-0">
      <p className="mb-2 text-[12px] text-ink-muted">{label}</p>
      {children}
    </div>
  );
}

function Segmented({
  options,
  value,
  onSelect,
}: {
  options: { id: string; label: string }[];
  value: string;
  onSelect: (id: string) => void;
}) {
  return (
    <div className="flex gap-1 rounded-lg bg-surface-2 p-1">
      {options.map((o) => {
        const active = o.id === value;
        return (
          <button
            key={o.id}
            type="button"
            onClick={() => onSelect(o.id)}
            aria-pressed={active}
            className={`flex-1 rounded-md px-2 py-1.5 text-[13px] transition-colors ${
              active
                ? "bg-clay text-on-clay"
                : "text-ink-soft hover:text-ink"
            }`}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

function GearIcon() {
  return (
    <svg viewBox="0 0 20 20" className="h-[18px] w-[18px]" aria-hidden>
      <path
        d="M10 12.6a2.6 2.6 0 1 0 0-5.2 2.6 2.6 0 0 0 0 5.2Z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
      />
      <path
        d="M16.1 12.1a1.3 1.3 0 0 0 .26 1.44l.05.05a1.6 1.6 0 1 1-2.26 2.26l-.05-.05a1.3 1.3 0 0 0-1.44-.26 1.3 1.3 0 0 0-.79 1.19v.13a1.6 1.6 0 1 1-3.2 0v-.07a1.3 1.3 0 0 0-.85-1.19 1.3 1.3 0 0 0-1.44.26l-.05.05a1.6 1.6 0 1 1-2.26-2.26l.05-.05a1.3 1.3 0 0 0 .26-1.44 1.3 1.3 0 0 0-1.19-.79H2.9a1.6 1.6 0 1 1 0-3.2h.07a1.3 1.3 0 0 0 1.19-.85 1.3 1.3 0 0 0-.26-1.44l-.05-.05A1.6 1.6 0 1 1 6.11 3.6l.05.05a1.3 1.3 0 0 0 1.44.26h.06a1.3 1.3 0 0 0 .79-1.19V2.6a1.6 1.6 0 1 1 3.2 0v.07a1.3 1.3 0 0 0 .79 1.19 1.3 1.3 0 0 0 1.44-.26l.05-.05a1.6 1.6 0 1 1 2.26 2.26l-.05.05a1.3 1.3 0 0 0-.26 1.44v.06a1.3 1.3 0 0 0 1.19.79h.13a1.6 1.6 0 1 1 0 3.2h-.07a1.3 1.3 0 0 0-1.19.79Z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
