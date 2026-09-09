"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { signOut, useSession } from "@/lib/auth-client";

/**
 * Header account control. Shows a "登入" link when signed out, and an avatar
 * dropdown (name / email + links + sign out) when signed in. Uses better-auth's
 * `useSession`, so it reflects login state without a page reload.
 */
export function UserMenu() {
  const { data, isPending } = useSession();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: MouseEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  if (isPending) {
    return (
      <span className="ml-2 h-9 w-9 rounded-full border border-line bg-surface-2" />
    );
  }

  const user = data?.user;
  if (!user) {
    return (
      <Link
        href="/login"
        className="ml-2 rounded-full border border-line-strong px-4 py-2 font-medium text-ink transition-colors hover:border-clay hover:text-clay"
      >
        登入
      </Link>
    );
  }

  const initial = (user.name || user.email || "?").trim().charAt(0).toUpperCase();

  return (
    <div ref={wrapRef} className="relative ml-2">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup="menu"
        aria-label="帳號"
        className="flex h-9 w-9 items-center justify-center overflow-hidden rounded-full border border-line bg-surface-2 text-[14px] font-medium text-ink transition-colors hover:border-line-strong"
      >
        {user.image ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={user.image}
            alt={user.name || "avatar"}
            referrerPolicy="no-referrer"
            className="h-full w-full object-cover"
          />
        ) : (
          initial
        )}
      </button>

      {open && (
        <div
          role="menu"
          className="pop absolute right-0 top-full z-40 mt-2 w-60 rounded-2xl border border-line bg-surface p-2 shadow-[var(--shadow)]"
        >
          <div className="px-3 py-2">
            <p className="truncate text-[14px] font-medium text-ink">
              {user.name || "Learner"}
            </p>
            <p className="truncate text-[12px] text-ink-muted">{user.email}</p>
          </div>

          <hr className="my-1 border-line" />

          <Link
            href="/scenarios"
            onClick={() => setOpen(false)}
            className="flex items-center justify-between rounded-lg px-3 py-2 text-[13px] text-ink-soft transition-colors hover:bg-surface-2 hover:text-ink"
          >
            開始練習 <span aria-hidden>→</span>
          </Link>
          <Link
            href="/usage"
            onClick={() => setOpen(false)}
            className="flex items-center justify-between rounded-lg px-3 py-2 text-[13px] text-ink-soft transition-colors hover:bg-surface-2 hover:text-ink"
          >
            用量統計 <span aria-hidden>→</span>
          </Link>

          <hr className="my-1 border-line" />

          <button
            type="button"
            disabled={signingOut}
            onClick={async () => {
              setSigningOut(true);
              await signOut();
              router.push("/");
              router.refresh();
            }}
            className="flex w-full items-center justify-between rounded-lg px-3 py-2 text-[13px] text-ink-soft transition-colors hover:bg-surface-2 hover:text-ink disabled:opacity-60"
          >
            {signingOut ? "登出中…" : "登出"}
            <span aria-hidden>⇥</span>
          </button>
        </div>
      )}
    </div>
  );
}
