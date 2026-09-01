import type { Metadata } from "next";
import Link from "next/link";
import { ScenarioPicker } from "@/components/scenario-picker";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { scenarios } from "@/lib/scenarios";

export const metadata: Metadata = {
  title: "選擇情境 — Fluently",
  description: "挑一個真實情境，開始今天的英文口說練習。",
};

export default function ScenariosPage() {
  return (
    <>
      <SiteHeader compact />

      <main className="flex-1 px-5 py-14 sm:px-8 sm:py-20">
        <div className="mx-auto w-full max-w-6xl">
          <Link
            href="/"
            className="text-[13px] text-ink-muted transition-colors hover:text-ink"
          >
            ← 回首頁
          </Link>

          <h1 className="rise mt-5 font-display text-[36px] leading-tight tracking-[-0.02em] sm:text-[44px]">
            今天想練哪個場面？
          </h1>
          <p className="rise mt-3 max-w-xl text-[16px] leading-7 text-ink-soft [animation-delay:80ms]">
            選一個情境，AI 家教會立刻進入角色。你隨時可以換，也隨時可以重來。
          </p>

          <div className="rise mt-10 [animation-delay:140ms]">
            <ScenarioPicker scenarios={scenarios} />
          </div>
        </div>
      </main>

      <SiteFooter />
    </>
  );
}
