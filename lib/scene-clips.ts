/**
 * Character footage for the immersive mode, keyed by conversation phase.
 *
 * This is the single source of truth for scene assets — no other file may
 * hardcode a still or video path. To bring a new asset online: drop the file
 * in, set `ready` to true. Nothing else changes.
 *
 * Cafe is currently on stills so we can walk the whole conversation before
 * wiring the clips in `public/scenes/cafe/animation/`. Scenarios without an
 * entry fall back to the tinted emoji panel, and every phase without a ready
 * asset falls back along its `fallback` chain.
 */

export type ScenePhase =
  | "warming"
  | "speaking"
  | "thinking"
  | "listening"
  | "paused"
  | "stalled";

export type SceneClip = {
  src: string;
  kind: "image" | "video";
  /** Looping ambience (true) vs a one-shot action (false). Stills ignore this. */
  loop: boolean;
  /** Whether the file actually exists yet. */
  ready: boolean;
  /** Where to look when this clip is not ready. "still" gives up. */
  fallback: ScenePhase | "still";
};

export type SceneClips = Record<ScenePhase, SceneClip>;

const CAFE = "/scenes/cafe";

export const SCENE_CLIPS: Record<string, SceneClips> = {
  cafe: {
    // Customer walks in — waving greeting. Held through the opening line
    // so this still is actually on screen, not a one-frame flash.
    warming: {
      src: `${CAFE}/scenario_d.jpeg`,
      kind: "image",
      loop: false,
      ready: true,
      fallback: "still",
    },
    // Looking at the guest, ready to take the order.
    listening: {
      src: `${CAFE}/scenario_a.jpeg`,
      kind: "image",
      loop: false,
      ready: true,
      fallback: "warming",
    },
    // Chin on hand. Later: animation/thinking.mp4
    thinking: {
      src: `${CAFE}/scenario_c.jpeg`,
      kind: "image",
      loop: false,
      ready: true,
      fallback: "warming",
    },
    // Same still as listening until a talking clip is wired.
    // Later: animation/talking.mp4
    speaking: {
      src: `${CAFE}/scenario_a.jpeg`,
      kind: "image",
      loop: false,
      ready: true,
      fallback: "listening",
    },

    paused: {
      src: `${CAFE}/scenario_a.jpeg`,
      kind: "image",
      loop: false,
      ready: false,
      fallback: "listening",
    },
    stalled: {
      src: `${CAFE}/scenario_a.jpeg`,
      kind: "image",
      loop: false,
      ready: false,
      fallback: "listening",
    },

    // scenario_b.png (hand on the register) is waiting on a checkout phase.
  },
};

export const clipsFor = (scenarioId: string): SceneClips | null =>
  SCENE_CLIPS[scenarioId] ?? null;

/** Every clip that exists for a scenario — these get mounted and preloaded. */
export function readyClips(scenarioId: string): SceneClip[] {
  const clips = clipsFor(scenarioId);
  if (!clips) return [];
  const seen = new Set<string>();
  return Object.values(clips).filter((clip) => {
    if (!clip.ready || seen.has(clip.src)) return false;
    seen.add(clip.src);
    return true;
  });
}

/**
 * Which clip should actually play for a phase. Walks the fallback chain and
 * returns null when it reaches "still" — or when the chain loops.
 */
export function resolveClip(
  scenarioId: string,
  phase: ScenePhase,
): SceneClip | null {
  const clips = clipsFor(scenarioId);
  if (!clips) return null;

  const seen = new Set<ScenePhase>();
  let cur: ScenePhase | "still" = phase;

  while (cur !== "still") {
    if (seen.has(cur)) return null;
    seen.add(cur);
    // Annotated because `cur` is reassigned from `clip.fallback` below, which
    // otherwise makes the inference circular.
    const clip: SceneClip | undefined = clips[cur];
    if (!clip) return null;
    if (clip.ready) return clip;
    cur = clip.fallback;
  }
  return null;
}
