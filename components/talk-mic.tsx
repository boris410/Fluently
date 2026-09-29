"use client";

const BAR_SCALE = [0.45, 0.8, 1, 0.7, 0.5];

/**
 * Single microphone control. Wave bars appear only while speech is detected.
 */
export function TalkMic({
  listening,
  voicing,
  level,
  disabled,
  onToggle,
}: {
  listening: boolean;
  voicing: boolean;
  level: number;
  disabled?: boolean;
  onToggle: () => void;
}) {
  const label = listening ? "送出這句話" : "開始說話";

  return (
    <button
      type="button"
      onClick={onToggle}
      disabled={disabled}
      aria-pressed={listening}
      aria-label={label}
      title={label}
      className={`relative flex h-16 w-16 items-center justify-center rounded-full border transition-colors disabled:opacity-40 ${
        listening
          ? "border-clay bg-clay text-on-clay shadow-[var(--shadow)]"
          : "border-line-strong bg-surface text-ink-soft hover:border-clay hover:text-clay"
      }`}
    >
      {voicing && (
        <span
          aria-hidden
          className="voice-wave pointer-events-none absolute inset-0 flex items-center justify-center gap-[3px]"
        >
          {BAR_SCALE.map((scale, i) => {
            const h = 6 + Math.max(0.12, level) * 22 * scale;
            return (
              <span
                key={i}
                className="w-[3px] rounded-full bg-current"
                style={{ height: `${h}px` }}
              />
            );
          })}
        </span>
      )}
      <MicIcon className={voicing ? "opacity-0" : undefined} />
    </button>
  );
}

function MicIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 20 20"
      className={`h-7 w-7 ${className ?? ""}`}
      aria-hidden
    >
      <rect
        x="7.4"
        y="2.6"
        width="5.2"
        height="9"
        rx="2.6"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
      />
      <path
        d="M4.6 9.2a5.4 5.4 0 0 0 10.8 0M10 14.6v2.8"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  );
}