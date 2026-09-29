"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { canListen, listenHold } from "@/lib/speech";

/** Longest a single tap-to-talk turn may stay open. */
export const LISTEN_LIMIT_MS = 30_000;

/**
 * One-button talk: first press opens the mic, second press stops and
 * returns the transcript. Pauses do not send. Hits the 30s cap → same as
 * the second press.
 */
export function useHoldMic({
  busy,
  onSend,
  setError,
}: {
  /** Tutor is speaking or a reply is in flight — do not open the mic. */
  busy: boolean;
  onSend: (text: string) => void;
  setError: (message: string | null) => void;
}) {
  const [listening, setListening] = useState(false);
  const [voicing, setVoicing] = useState(false);
  const [level, setLevel] = useState(0);
  const sessionRef = useRef<{ stop: () => string } | null>(null);
  const timerRef = useRef(0);

  const supported = useSyncExternalStore(
    useCallback(() => () => {}, []),
    () => canListen(),
    () => true,
  );

  const close = useCallback(() => {
    window.clearTimeout(timerRef.current);
    timerRef.current = 0;
    const session = sessionRef.current;
    sessionRef.current = null;
    setListening(false);
    setVoicing(false);
    setLevel(0);
    return session?.stop() ?? "";
  }, []);

  useEffect(() => () => void close(), [close]);

  const finishTurn = useCallback(
    (text: string) => {
      if (text) {
        setError(null);
        onSend(text);
      } else {
        setError("沒聽到聲音");
      }
    },
    [onSend, setError],
  );

  const toggle = useCallback(() => {
    if (sessionRef.current) {
      finishTurn(close());
      return;
    }

    if (busy || !canListen()) return;

    setError(null);
    const session = listenHold({
      onStart: () => setListening(true),
      onLevel: (nextLevel, speaking) => {
        setLevel(nextLevel);
        setVoicing(speaking);
      },
      onError: (err) => {
        close();
        if (err === "not-allowed") {
          setError("瀏覽器擋住了麥克風權限。");
        } else {
          setError(`語音辨識失敗：${err}`);
        }
      },
    });

    if (!session) {
      setError("這個瀏覽器不支援語音輸入。");
      return;
    }
    sessionRef.current = session;
    setListening(true);
    timerRef.current = window.setTimeout(() => {
      if (!sessionRef.current) return;
      finishTurn(close());
    }, LISTEN_LIMIT_MS);
  }, [busy, close, finishTurn, setError]);

  return { listening, voicing, level, toggle, close, supported };
}
