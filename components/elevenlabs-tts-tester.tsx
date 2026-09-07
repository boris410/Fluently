"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ELEVENLABS_MODELS } from "@/lib/elevenlabs";

export function ElevenLabsTtsTester({
  configured,
  voiceId,
}: {
  configured: boolean;
  voiceId: string | null;
}) {
  const [text, setText] = useState("Hello, what do you have in mind today?");
  const [model, setModel] = useState(ELEVENLABS_MODELS[0].id);
  const [isLoading, setIsLoading] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [latencyMs, setLatencyMs] = useState<number | null>(null);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const urlRef = useRef<string | null>(null);

  const stop = useCallback(() => {
    audioRef.current?.pause();
    audioRef.current = null;
    if (urlRef.current) {
      URL.revokeObjectURL(urlRef.current);
      urlRef.current = null;
    }
    setPlaying(false);
  }, []);

  useEffect(() => () => stop(), [stop]);

  const handleSpeak = async () => {
    if (!text.trim() || isLoading || !voiceId) return;
    stop();
    setIsLoading(true);
    setError(null);
    setLatencyMs(null);

    try {
      const response = await fetch("/api/elevenlabs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: text.trim(),
          model,
        }),
      });

      if (!response.ok) {
        const data = (await response.json().catch(() => null)) as {
          error?: string;
        } | null;
        throw new Error(data?.error ?? `語音合成失敗（${response.status}）`);
      }

      const latency = Number(response.headers.get("x-latency"));
      if (Number.isFinite(latency)) setLatencyMs(latency);

      const blob = await response.blob();
      const audioUrl = URL.createObjectURL(blob);
      urlRef.current = audioUrl;

      const audio = new Audio(audioUrl);
      audioRef.current = audio;
      audio.onended = () => {
        setPlaying(false);
        if (urlRef.current) {
          URL.revokeObjectURL(urlRef.current);
          urlRef.current = null;
        }
        audioRef.current = null;
      };
      audio.onerror = () => {
        setError("音訊播放失敗");
        stop();
      };
      await audio.play();
      setPlaying(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "語音合成失敗");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="rounded-2xl border border-line bg-surface p-5 sm:p-6">
      {!configured && (
        <div className="mb-5 rounded-xl border border-clay/40 bg-clay-wash px-4 py-3 text-[14px] leading-6">
          還沒設定 ElevenLabs API key。在
          <code className="mx-1 font-mono text-[13px]">.env.local</code>
          加上 <code className="font-mono text-[13px]">ELEVENLABS_API_KEY</code>
          後重開 dev server。
        </div>
      )}
      {configured && !voiceId && (
        <div className="mb-5 rounded-xl border border-clay/40 bg-clay-wash px-4 py-3 text-[14px] leading-6">
          還沒設定音色。在
          <code className="mx-1 font-mono text-[13px]">.env.local</code>
          加上 <code className="font-mono text-[13px]">ELEVENLABS_VOICE_ID</code>
          後重開 dev server。
        </div>
      )}

      <label className="block text-[13px] text-ink-muted">要唸的句子</label>
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={4}
        className="mt-2 w-full resize-y rounded-[20px] border border-line bg-canvas px-4 py-3 text-[16px] leading-7 text-ink placeholder:text-ink-muted focus:border-line-strong focus:outline-none"
      />

      <div className="mt-5 grid gap-4 sm:grid-cols-2">
        <label className="block">
          <span className="text-[13px] text-ink-muted">Voice ID（.env.local）</span>
          <p className="mt-2 truncate rounded-xl border border-line bg-canvas px-3 py-2.5 font-mono text-[13px] text-ink">
            {voiceId ?? "尚未設定 ELEVENLABS_VOICE_ID"}
          </p>
        </label>
        <label className="block">
          <span className="text-[13px] text-ink-muted">模型</span>
          <select
            value={model}
            onChange={(e) => setModel(e.target.value)}
            className="mt-2 w-full rounded-xl border border-line bg-canvas px-3 py-2.5 text-[14px] text-ink focus:border-line-strong focus:outline-none"
          >
            {ELEVENLABS_MODELS.map((m) => (
              <option key={m.id} value={m.id}>
                {m.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="mt-6 flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={() => void handleSpeak()}
          disabled={isLoading || !text.trim() || !configured || !voiceId}
          className="inline-flex h-13 items-center rounded-full bg-clay px-7 text-[16px] font-medium text-on-clay shadow-[var(--shadow)] transition-colors hover:bg-clay-deep disabled:opacity-40"
        >
          {isLoading ? "生成語音中…" : "播放語音"}
        </button>
        {playing && (
          <button
            type="button"
            onClick={stop}
            className="rounded-full border border-line-strong px-4 py-2 font-medium text-ink transition-colors hover:border-clay hover:text-clay"
          >
            停止
          </button>
        )}
        {latencyMs !== null && (
          <span className="font-mono text-[12px] text-ink-muted">
            {(latencyMs / 1000).toFixed(1)}s
          </span>
        )}
      </div>

      {error && (
        <div className="mt-5 rounded-xl border border-line bg-surface-2 px-4 py-3 text-[14px] leading-6 text-ink-soft">
          {error}
        </div>
      )}
    </div>
  );
}
