"use client";

import { useCallback, useEffect, useRef, useSyncExternalStore } from "react";
import Image from "next/image";
import type { Scenario } from "@/lib/scenarios";
import {
  type ScenePhase,
  readyClips,
  resolveClip,
} from "@/lib/scene-clips";

/**
 * The portrait stage that replaced the Orb in immersive mode.
 *
 * Every ready still and clip a scenario has is mounted at once; switching
 * only toggles opacity. Swapping `src` on a single layer flashes on every
 * change, and there are at most a handful of assets per scenario, so keeping
 * them all decoded is the cheaper trade.
 *
 * Phases without their own footage fall back along the chain in
 * `lib/scene-clips.ts`, so the character stays on screen instead of dropping
 * to a placeholder mid-conversation. Scenarios with no footage at all get the
 * tinted emoji panel, keeping the same stage shape either way.
 */

/** Native size of the cafe footage; every future clip must match. */
const ASPECT = "880 / 1072";

const layerClass =
  "absolute inset-0 h-full w-full object-cover transition-opacity duration-300";

const prefersReducedMotion = () =>
  typeof window !== "undefined" &&
  window.matchMedia("(prefers-reduced-motion: reduce)").matches;

export function SceneStage({
  scenario,
  phase,
}: {
  scenario: Scenario;
  phase: ScenePhase;
}) {
  const videos = useRef(new Map<string, HTMLVideoElement>());

  const subscribe = useCallback((onChange: () => void) => {
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    query.addEventListener("change", onChange);
    return () => query.removeEventListener("change", onChange);
  }, []);
  const reduceMotion = useSyncExternalStore(
    subscribe,
    prefersReducedMotion,
    () => false,
  );

  const clips = readyClips(scenario.id);
  const active = resolveClip(scenario.id, phase);
  const activeSrc = active?.src ?? null;

  // Only the visible clip runs. The rest stay paused on their last frame so
  // switching back to them is instant and costs no decoding meanwhile.
  // A paused conversation freezes the character too — motion would imply the
  // session is still live. Stills have nothing to play.
  const shouldPlay = !reduceMotion && phase !== "paused";

  useEffect(() => {
    for (const [src, el] of videos.current) {
      if (src === activeSrc && shouldPlay) {
        void el.play().catch(() => {});
      } else {
        el.pause();
      }
    }
  }, [activeSrc, shouldPlay]);

  const frame =
    "relative w-full overflow-hidden rounded-3xl border border-line bg-canvas-deep shadow-[var(--shadow)]";

  if (clips.length === 0) {
    // No footage for this scenario — keep the same stage shape so the layout
    // does not jump between scenarios that have assets and ones that don't.
    return (
      <div
        className={`tinted ${frame} flex items-center justify-center`}
        style={
          {
            aspectRatio: ASPECT,
            "--tint-light": scenario.tint[0],
            "--tint-dark": scenario.tint[1],
          } as React.CSSProperties
        }
      >
        <span className="text-[72px]" aria-hidden>
          {scenario.emoji}
        </span>
        <span className="sr-only">{scenario.title}</span>
      </div>
    );
  }

  return (
    <div className={frame} style={{ aspectRatio: ASPECT }}>
      {clips.map((clip) =>
        clip.kind === "image" ? (
          <div
            key={clip.src}
            aria-hidden
            className="absolute inset-0 transition-opacity duration-300"
            style={{ opacity: clip.src === activeSrc ? 1 : 0 }}
          >
            <Image
              src={clip.src}
              alt=""
              fill
              sizes="340px"
              draggable={false}
              loading="eager"
              priority={clip.src === activeSrc}
              className="object-cover"
            />
          </div>
        ) : (
          <video
            key={clip.src}
            ref={(el) => {
              if (el) videos.current.set(clip.src, el);
              else videos.current.delete(clip.src);
            }}
            src={clip.src}
            loop={clip.loop}
            muted
            playsInline
            preload="auto"
            aria-hidden
            className={layerClass}
            style={{ opacity: clip.src === activeSrc ? 1 : 0 }}
          />
        ),
      )}

      {/* Nothing resolved and nothing has played yet: show the scenario mark
          rather than an empty black rectangle. */}
      {!activeSrc && (
        <div
          className="tinted absolute inset-0 flex items-center justify-center"
          style={
            {
              "--tint-light": scenario.tint[0],
              "--tint-dark": scenario.tint[1],
            } as React.CSSProperties
          }
        >
          <span className="text-[72px]" aria-hidden>
            {scenario.emoji}
          </span>
        </div>
      )}
    </div>
  );
}
