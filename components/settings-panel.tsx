"use client";

import {
  useCallback,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import {
  CORNERS,
  SCALES,
  type Corner,
  patchDevToolsConfig,
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
  subscribeSettings,
} from "@/lib/settings";
import { VOICES } from "@/lib/gemini";
import { canSpeak } from "@/lib/speech";

function subscribeNever() {
  return () => {};
}

function subscribeTheme(onChange: () => void) {
  window.addEventListener("storage", onChange);
  return () => window.removeEventListener("storage", onChange);
}

export function GeminiKeyPane() {
  const hydrated = useSyncExternalStore(subscribeNever, () => true, () => false);
  const storedKey = useSyncExternalStore(subscribeSettings, getApiKey, () => "");
  const [keyDraft, setKeyDraft] = useState<string | null>(null);
  const [keyStatus, setKeyStatus] = useState<
    "idle" | "checking" | "ok" | "bad"
  >("idle");
  const [keyMessage, setKeyMessage] = useState("");

  const keyValue = keyDraft ?? storedKey;

  const saveKey = useCallback(async () => {
    if (!hydrated) return;
    setApiKey(keyValue);
    if (!keyValue.trim()) {
      setKeyStatus("idle");
      setKeyMessage("已清除");
      return;
    }
    setKeyStatus("checking");
    setKeyMessage("");
    try {
      const res = await fetch("/api/key-check", {
        method: "POST",
        headers: { "x-gemini-key": keyValue.trim() },
      });
      const data = await res.json();
      setKeyStatus(data.ok ? "ok" : "bad");
      setKeyMessage(data.ok ? "已驗證，可以開始對話" : (data.message ?? "驗證失敗"));
    } catch {
      setKeyStatus("bad");
      setKeyMessage("無法連線到伺服器");
    }
  }, [hydrated, keyValue]);

  return (
    <div>
      <div className="flex gap-2">
        <input
          type="password"
          value={keyValue}
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
          disabled={!hydrated || keyStatus === "checking"}
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
            伺服器已有 key 時這裡可以留空。貼上的 key 只存在這個瀏覽器，不會寫進資料庫。
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
    </div>
  );
}

export function TutorVoicePane() {
  const autoSpeak = useSyncExternalStore(
    subscribeSettings,
    getAutoSpeak,
    () => true,
  );
  const voiceSource = useSyncExternalStore(
    subscribeSettings,
    getVoiceSource,
    () => "elevenlabs" as VoiceSource,
  );
  const voiceName = useSyncExternalStore(
    subscribeSettings,
    getVoiceName,
    () => VOICES[0].id,
  );
  const storedTheme = useSyncExternalStore(
    subscribeTheme,
    readStoredTheme,
    () => "system" as Theme,
  );

  const [theme, setTheme] = useState<Theme | null>(null);
  const themeValue = theme ?? storedTheme;

  const pickTheme = useCallback((next: Theme) => {
    setTheme(next);
    storeTheme(next);
    applyTheme(next);
    void patchDevToolsConfig({ theme: next });
  }, []);

  return (
    <div className="space-y-8">
      <div>
        <Segmented
          options={[
            { id: "elevenlabs", label: "角色" },
            { id: "gemini", label: "Gemini" },
            { id: "browser", label: "系統" },
          ]}
          value={voiceSource}
          onSelect={(id) => {
            setVoiceSource(id as VoiceSource);
          }}
        />

        {voiceSource === "gemini" ? (
          <>
            <select
              value={voiceName}
              onChange={(e) => {
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
        ) : voiceSource === "elevenlabs" ? (
          <p className="mt-2 text-[12px] leading-5 text-ink-muted">
            角色音色走 ElevenLabs，由音色目錄指定。同一句重播不會再合成，失敗時退回瀏覽器語音。
          </p>
        ) : (
          <p className="mt-2 text-[12px] leading-5 text-ink-muted">
            使用系統內建語音：免費、即時、不耗額度，但聽起來比較機械。
          </p>
        )}

        <button
          type="button"
          onClick={() => {
            setAutoSpeak(!autoSpeak);
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
      </div>

      <Section label="外觀">
        <Segmented
          options={THEMES.map((t) => ({ id: t.id, label: t.label }))}
          value={themeValue}
          onSelect={(id) => pickTheme(id as Theme)}
        />
      </Section>
    </div>
  );
}

export function DevToolsPane({
  corner,
  scaleId,
  indicatorHidden,
  onCorner,
  onScaleId,
  onHideIndicator,
}: {
  corner: Corner;
  scaleId: string;
  indicatorHidden: boolean;
  onCorner: (corner: Corner) => void;
  onScaleId: (id: string) => void;
  onHideIndicator: () => void;
}) {
  return (
    <div>
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
            onCorner(id as Corner);
            void patchDevToolsConfig({ devToolsPosition: id as Corner });
          }}
        />
      </Section>

      <div className="mt-8">
        <Section label="指示器大小">
          <Segmented
            options={SCALES.map((s) => ({ id: s.id, label: s.label }))}
            value={scaleId}
            onSelect={(id) => {
              onScaleId(id);
              const scale = SCALES.find((s) => s.id === id)?.value;
              if (scale) void patchDevToolsConfig({ scale });
            }}
          />
        </Section>
      </div>

      <button
        type="button"
        disabled={indicatorHidden}
        onClick={onHideIndicator}
        className="mt-3 w-full rounded-lg border border-line px-3 py-2 text-[13px] text-ink-soft transition-colors hover:border-line-strong hover:text-ink disabled:cursor-not-allowed disabled:opacity-50"
      >
        {indicatorHidden ? "已隱藏（重新整理生效）" : "隱藏指示器 24 小時"}
      </button>
      <p className="mt-2 text-[12px] leading-5 text-ink-muted">
        隱藏狀態只存在 dev server 記憶體，沒有還原用的端點——
        重啟 <code className="font-mono">npm run dev</code> 即可叫回來。
      </p>
    </div>
  );
}

function Section({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <div>
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
