"use client";

import { apiHeaders, getVoiceName, getVoiceSource } from "@/lib/settings";

/**
 * Two ways to give the tutor a voice:
 *
 *  - `elevenlabs` — character voice via `/api/elevenlabs` (default)
 *  - `gemini`     — Gemini TTS, natural sounding, costs audio tokens
 *  - `browser`    — the built-in speech synthesiser, free and instant
 *
 * Cloud voices silently fall back to the browser when a call fails, so the
 * conversation never goes quiet. Generated clips are cached per (source,
 * voice, text) so replaying a line costs nothing.
 */

export type SpeakState = "loading" | "playing" | "idle";

// --- speech recognition (learner speaking) ------------------------------

type SpeechRecognitionLike = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  start(): void;
  stop(): void;
  abort(): void;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onstart: (() => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  onend: (() => void) | null;
};

type SpeechRecognitionEventLike = {
  resultIndex: number;
  results: ArrayLike<ArrayLike<{ transcript: string }> & { isFinal: boolean }>;
};

type RecognitionCtor = new () => SpeechRecognitionLike;

function getRecognitionCtor(): RecognitionCtor | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as {
    SpeechRecognition?: RecognitionCtor;
    webkitSpeechRecognition?: RecognitionCtor;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

export const canListen = () => getRecognitionCtor() !== null;

const VOICE_ON = 0.07;
const VOICE_OFF = 0.04;

function startVoiceMeter(
  onLevel: (level: number, voicing: boolean) => void,
): () => void {
  let stopped = false;
  let raf = 0;
  let voicing = false;
  let ctx: AudioContext | null = null;
  let stream: MediaStream | null = null;

  void (async () => {
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      if (stopped) {
        stream.getTracks().forEach((t) => t.stop());
        return;
      }
      const AC =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext?: typeof AudioContext })
          .webkitAudioContext;
      if (!AC) return;
      ctx = new AC();
      const source = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 512;
      source.connect(analyser);
      const data = new Uint8Array(analyser.fftSize);

      const tick = () => {
        if (stopped) return;
        analyser.getByteTimeDomainData(data);
        let sum = 0;
        for (let i = 0; i < data.length; i++) {
          const v = (data[i] - 128) / 128;
          sum += v * v;
        }
        const level = Math.min(1, Math.sqrt(sum / data.length) * 4);
        if (level >= VOICE_ON) voicing = true;
        else if (level <= VOICE_OFF) voicing = false;
        onLevel(level, voicing);
        raf = window.requestAnimationFrame(tick);
      };
      raf = window.requestAnimationFrame(tick);
    } catch {
      // Permission or no device — recognition may still work; no waveform.
    }
  })();

  return () => {
    stopped = true;
    window.cancelAnimationFrame(raf);
    stream?.getTracks().forEach((t) => t.stop());
    void ctx?.close();
  };
}

/**
 * Hold-to-talk dictation. The mic stays open until the caller stops it;
 * pauses do not send. Returns null if recognition cannot start. `stop()`
 * yields the accumulated transcript (may be empty).
 */
export function listenHold(handlers: {
  onStart?: () => void;
  onLevel?: (level: number, voicing: boolean) => void;
  onPartial?: (text: string) => void;
  onError?: (error: string) => void;
}): { stop: () => string } | null {
  const Ctor = getRecognitionCtor();
  if (!Ctor) return null;

  const recognition = new Ctor();
  recognition.lang = "en-US";
  recognition.continuous = true;
  recognition.interimResults = true;

  let userStop = false;
  let committed = "";
  let finals = "";
  let interim = "";
  const stopMeter = startVoiceMeter((level, voicing) => {
    handlers.onLevel?.(level, voicing || interim.length > 0);
  });

  const snapshot = () =>
    `${committed} ${finals} ${interim}`.replace(/\s+/g, " ").trim();

  recognition.onresult = (event) => {
    let nextFinals = "";
    let nextInterim = "";
    for (let i = 0; i < event.results.length; i++) {
      const result = event.results[i];
      const piece = result[0]?.transcript ?? "";
      if (result.isFinal) nextFinals += piece;
      else nextInterim += piece;
    }
    finals = nextFinals;
    interim = nextInterim;
    const text = snapshot();
    handlers.onPartial?.(text);
    if (text) handlers.onLevel?.(0.35, true);
  };
  recognition.onstart = () => handlers.onStart?.();
  recognition.onerror = (event) => {
    if (event.error === "no-speech" || event.error === "aborted") return;
    handlers.onError?.(event.error);
  };
  recognition.onend = () => {
    if (userStop) return;
    // Chrome drops a continuous session on pause; keep what we heard
    // and reopen so a breath does not wipe the turn.
    committed = snapshot();
    finals = "";
    interim = "";
    try {
      recognition.start();
    } catch {
      // Already running, or the user stopped between end and restart.
    }
  };

  try {
    recognition.start();
  } catch (error) {
    stopMeter();
    handlers.onError?.(
      error instanceof DOMException ? error.name : "start-failed",
    );
    return null;
  }

  return {
    stop() {
      userStop = true;
      stopMeter();
      try {
        recognition.stop();
      } catch {
        recognition.abort();
      }
      return snapshot();
    },
  };
}

// --- speech synthesis (tutor speaking) ----------------------------------

export const canSpeak = () =>
  typeof window !== "undefined" && "speechSynthesis" in window;

let currentAudio: HTMLAudioElement | null = null;
const clipCache = new Map<string, string>();

export function stopSpeaking() {
  if (currentAudio) {
    currentAudio.pause();
    currentAudio.currentTime = 0;
    currentAudio = null;
  }
  if (canSpeak()) window.speechSynthesis.cancel();
}

function speakInBrowser(
  text: string,
  onState?: (s: SpeakState) => void,
  onBlocked?: () => void,
) {
  if (!canSpeak()) {
    onState?.("idle");
    return;
  }
  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = "en-US";
  utterance.rate = 0.95;
  const voice = window.speechSynthesis
    .getVoices()
    .find((v) => v.lang.startsWith("en"));
  if (voice) utterance.voice = voice;

  let started = false;
  utterance.onstart = () => {
    started = true;
    onState?.("playing");
  };
  utterance.onend = () => onState?.("idle");
  utterance.onerror = () => onState?.("idle");
  window.speechSynthesis.speak(utterance);

  // There is no rejection to catch here: a browser that refuses to speak
  // before a user gesture simply stays silent. Treat "nothing happened" as
  // blocked so the UI can offer a one-tap unlock.
  window.setTimeout(() => {
    if (!started && !window.speechSynthesis.speaking) {
      onState?.("idle");
      onBlocked?.();
    }
  }, 900);
}

class ClipError extends Error {
  sessionId: string | null;

  constructor(message: string, sessionId: string | null) {
    super(message);
    this.name = "ClipError";
    this.sessionId = sessionId;
  }
}

async function fetchClip(options: {
  path: "/api/speak" | "/api/elevenlabs";
  text: string;
  voice?: string;
  scenarioId: string;
  sessionId: string | null;
  mode?: "script" | "live";
}): Promise<{ url: string; sessionId: string | null }> {
  const res = await fetch(options.path, {
    method: "POST",
    headers: apiHeaders(),
    body: JSON.stringify({
      text: options.text,
      voice: options.voice,
      scenarioId: options.scenarioId,
      sessionId: options.sessionId,
      mode: options.mode,
    }),
  });

  if (!res.ok) {
    const detail = await res.json().catch(() => null);
    throw new ClipError(
      detail?.error ?? `語音合成失敗（${res.status}）`,
      typeof detail?.sessionId === "string" ? detail.sessionId : null,
    );
  }

  const blob = await res.blob();
  return {
    url: URL.createObjectURL(blob),
    sessionId: res.headers.get("x-session-id"),
  };
}

function play(url: string, onState?: (s: SpeakState) => void) {
  const audio = new Audio(url);
  currentAudio = audio;
  audio.onplay = () => onState?.("playing");
  audio.onended = () => {
    if (currentAudio === audio) currentAudio = null;
    onState?.("idle");
  };
  audio.onerror = () => {
    if (currentAudio === audio) currentAudio = null;
    onState?.("idle");
  };
  return audio.play();
}

/**
 * Speaks one tutor line. Resolves once playback has started (or the browser
 * fallback has been handed the text).
 */
export async function speakReply(
  text: string,
  options: {
    scenarioId: string;
    sessionId: string | null;
    mode?: "script" | "live";
    onState?: (state: SpeakState) => void;
    /** Called when cloud TTS failed and the browser voice took over. */
    onFallback?: (reason: string) => void;
    /** Called with the session the audio was booked against. */
    onSession?: (sessionId: string) => void;
    /** Called when the browser refused to play without a user gesture. */
    onBlocked?: () => void;
  },
): Promise<string | null> {
  stopSpeaking();

  // Yield once so callers can invoke this straight from an effect without
  // setting React state synchronously during that effect.
  await Promise.resolve();

  const source = getVoiceSource();
  if (source === "browser") {
    speakInBrowser(text, options.onState, options.onBlocked);
    return options.sessionId;
  }

  const voice = source === "elevenlabs" ? "elevenlabs" : getVoiceName();
  const cacheKey = `${source}::${voice}::${text}`;
  const cached = clipCache.get(cacheKey);

  // Skip the cache when we still need the server to mint a session.
  if (cached && options.sessionId) {
    options.onState?.("loading");
    try {
      await play(cached, options.onState);
      return options.sessionId;
    } catch (error) {
      if (isAutoplayBlocked(error)) {
        options.onState?.("idle");
        options.onBlocked?.();
        return options.sessionId;
      }
      clipCache.delete(cacheKey);
    }
  }

  options.onState?.("loading");
  try {
    const clip = await fetchClip({
      path: source === "elevenlabs" ? "/api/elevenlabs" : "/api/speak",
      text,
      voice: source === "gemini" ? voice : undefined,
      scenarioId: options.scenarioId,
      sessionId: options.sessionId,
      mode: options.mode,
    });
    clipCache.set(cacheKey, clip.url);
    if (clip.sessionId) options.onSession?.(clip.sessionId);
    await play(clip.url, options.onState);
    return clip.sessionId;
  } catch (error) {
    const bookedId = error instanceof ClipError ? error.sessionId : null;
    if (bookedId) options.onSession?.(bookedId);
    options.onState?.("idle");

    // A blocked autoplay is not a TTS failure — the clip is fine, the
    // page just has not been interacted with yet. Falling back to the
    // browser voice would be blocked too.
    if (isAutoplayBlocked(error)) {
      options.onBlocked?.();
      return bookedId ?? options.sessionId;
    }

    options.onFallback?.(
      error instanceof Error ? error.message : "語音合成失敗",
    );
    speakInBrowser(text, options.onState, options.onBlocked);
    return bookedId ?? options.sessionId;
  }
}

const isAutoplayBlocked = (error: unknown) =>
  error instanceof DOMException && error.name === "NotAllowedError";
