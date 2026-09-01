"use client";

import { DEFAULT_MODEL, DEFAULT_VOICE, isKnownVoice } from "@/lib/gemini";

/**
 * Client-side preferences. The API key stays in this browser and is sent
 * per-request to our own route handler, which forwards it to Google — it is
 * never written to the database.
 */

export const KEYS = {
  apiKey: "fluently-gemini-key",
  autoSpeak: "fluently-auto-speak",
  voiceSource: "fluently-voice-source",
  voiceName: "fluently-voice-name",
} as const;

/** Where the tutor's voice comes from. */
export type VoiceSource = "gemini" | "browser";

function read(key: string): string | null {
  if (typeof window === "undefined") return null;
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function write(key: string, value: string | null) {
  try {
    if (value === null) localStorage.removeItem(key);
    else localStorage.setItem(key, value);
  } catch {
    // Non-persistent session; the current page still works.
  }
}

const CHANGE_EVENT = "fluently:settings-changed";

/** Lets components re-read settings the moment they change, in any tab. */
export function subscribeSettings(onChange: () => void) {
  window.addEventListener(CHANGE_EVENT, onChange);
  window.addEventListener("storage", onChange);
  return () => {
    window.removeEventListener(CHANGE_EVENT, onChange);
    window.removeEventListener("storage", onChange);
  };
}

function notify() {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event(CHANGE_EVENT));
  }
}

export const getApiKey = () => read(KEYS.apiKey) ?? "";
export const setApiKey = (value: string) => {
  write(KEYS.apiKey, value.trim() || null);
  notify();
};

export const getAutoSpeak = () => read(KEYS.autoSpeak) !== "off";
export const setAutoSpeak = (on: boolean) => {
  write(KEYS.autoSpeak, on ? "on" : "off");
  notify();
};

/** Browser speech is the default: instant, free, and always available. */
export const getVoiceSource = (): VoiceSource =>
  read(KEYS.voiceSource) === "gemini" ? "gemini" : "browser";
export const setVoiceSource = (source: VoiceSource) => {
  write(KEYS.voiceSource, source);
  notify();
};

export const getVoiceName = () => {
  const stored = read(KEYS.voiceName);
  return stored && isKnownVoice(stored) ? stored : DEFAULT_VOICE;
};
export const setVoiceName = (name: string) => {
  write(KEYS.voiceName, name);
  notify();
};

export { DEFAULT_MODEL, DEFAULT_VOICE };

/** Headers for calls to our own API routes. */
export function apiHeaders(): HeadersInit {
  const key = getApiKey();
  return {
    "Content-Type": "application/json",
    ...(key ? { "x-gemini-key": key } : {}),
  };
}
