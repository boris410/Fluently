"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { canListen, listenHold } from "@/lib/speech";

/**
 * One-button talk: first press opens the mic, second press stops and
 * returns the transcript. Pauses do not send.
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

  const supported = useSyncExternalStore(
    useCallback(() => () => {}, []),
    () => canListen(),
    () => true,
  );

  const close = useCallback(() => {
    const session = sessionRef.current;
    sessionRef.current = null;
    setListening(false);
    setVoicing(false);
    setLevel(0);
    return session?.stop() ?? "";
  }, []);

  useEffect(() => () => void close(), [close]);

  const toggle = useCallback(() => {
    if (sessionRef.current) {
      const text = close();
      if (text) {
        setError(null);
        onSend(text);
      } else {
        setError("沒聽到聲音");
      }
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
  }, [busy, close, onSend, setError]);

  return { listening, voicing, level, toggle, close, supported };
}
