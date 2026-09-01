"use client";

import { apiHeaders, getVoiceName, getVoiceSource } from "@/lib/settings";

/**
 * Two ways to give the tutor a voice:
 *
 *  - `gemini`  — Gemini TTS, natural sounding, costs audio tokens
 *  - `browser` — the built-in speech synthesiser, free and instant
 *
 * Gemini is the default and silently falls back to the browser voice when a
 * call fails, so the conversation never goes quiet. Generated clips are
 * cached per (text, voice) so replaying a line costs nothing.
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

/**
 * Starts one dictation turn. `continuous: false` means the browser ends the
 * turn by itself once the speaker pauses, which is what hands-free mode
 * relies on. Returns a stop function, or null when it could not start.
 */
export function listen(handlers: {
  onText: (text: string, isFinal: boolean) => void;
  onStart?: () => void;
  onError?: (error: string) => void;
  onEnd?: () => void;
}): (() => void) | null {
  const Ctor = getRecognitionCtor();
  if (!Ctor) return null;

  const recognition = new Ctor();
  recognition.lang = "en-US";
  recognition.continuous = false;
  recognition.interimResults = true;

  recognition.onresult = (event) => {
    let text = "";
    let isFinal = false;
    for (let i = 0; i < event.results.length; i++) {
      const result = event.results[i];
      text += result[0]?.transcript ?? "";
      if (result.isFinal) isFinal = true;
    }
    handlers.onText(text.trim(), isFinal);
  };
  recognition.onstart = () => handlers.onStart?.();
  recognition.onerror = (event) => handlers.onError?.(event.error);
  recognition.onend = () => handlers.onEnd?.();

  try {
    recognition.start();
  } catch (error) {
    // Starting an already-running recogniser throws InvalidStateError. The
    // hands-free loop restarts often, so this must never bubble up.
    handlers.onError?.(
      error instanceof DOMException ? error.name : "start-failed",
    );
    return null;
  }

  return () => recognition.abort();
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

async function fetchClip(options: {
  text: string;
  voice: string;
  scenarioId: string;
  sessionId: string | null;
}): Promise<{ url: string; sessionId: string | null }> {
  const res = await fetch("/api/speak", {
    method: "POST",
    headers: apiHeaders(),
    body: JSON.stringify({
      text: options.text,
      voice: options.voice,
      scenarioId: options.scenarioId,
      sessionId: options.sessionId,
    }),
  });

  if (!res.ok) {
    const detail = await res.json().catch(() => null);
    throw new Error(detail?.error ?? `語音合成失敗（${res.status}）`);
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
    onState?: (state: SpeakState) => void;
    /** Called when Gemini failed and the browser voice took over. */
    onFallback?: (reason: string) => void;
    /** Called with the session the audio was booked against. */
    onSession?: (sessionId: string) => void;
    /** Called when the browser refused to play without a user gesture. */
    onBlocked?: () => void;
  },
) {
  stopSpeaking();

  // Yield once so callers can invoke this straight from an effect without
  // setting React state synchronously during that effect.
  await Promise.resolve();

  if (getVoiceSource() === "browser") {
    speakInBrowser(text, options.onState, options.onBlocked);
    return;
  }

  const voice = getVoiceName();
  const cacheKey = `${voice}::${text}`;
  const cached = clipCache.get(cacheKey);

  if (cached) {
    options.onState?.("loading");
    try {
      await play(cached, options.onState);
      return;
    } catch (error) {
      if (isAutoplayBlocked(error)) {
        options.onState?.("idle");
        options.onBlocked?.();
        return;
      }
      clipCache.delete(cacheKey);
    }
  }

  options.onState?.("loading");
  try {
    const clip = await fetchClip({
      text,
      voice,
      scenarioId: options.scenarioId,
      sessionId: options.sessionId,
    });
    clipCache.set(cacheKey, clip.url);
    if (clip.sessionId) options.onSession?.(clip.sessionId);
    await play(clip.url, options.onState);
  } catch (error) {
    options.onState?.("idle");

    // A blocked autoplay is not a Gemini failure — the clip is fine, the
    // page just has not been interacted with yet. Falling back to the
    // browser voice would be blocked too.
    if (isAutoplayBlocked(error)) {
      options.onBlocked?.();
      return;
    }

    options.onFallback?.(
      error instanceof Error ? error.message : "語音合成失敗",
    );
    speakInBrowser(text, options.onState, options.onBlocked);
  }
}

const isAutoplayBlocked = (error: unknown) =>
  error instanceof DOMException && error.name === "NotAllowedError";
