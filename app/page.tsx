import Link from "next/link";
import { HeroComposer } from "@/components/hero-composer";
import { Mark } from "@/components/logo";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { listScenarios } from "@/lib/db";

const FEATURES = [
  {
    icon: "🎭",
    title: "先選情境，再開口",
    body: "咖啡廳、機場、面試、會議⋯⋯每個情境都有自己的角色、語氣和目標，不是漫無邊際地聊天。",
  },
  {
    icon: "🧠",
    title: "AI 家教會接話",
    body: "由 Gemini 驅動的家教會順著你的話往下聊，卡住時給提示，說錯時溫柔地示範一次正確講法。",
  },
  {
    icon: "🗂️",
    title: "它記得你",
    body: "對話與常錯的句型存在本地 SQLite，下次一開口，它就知道上次你練到哪、哪個字總是說不順。",
  },
];

const STEPS = [
  { n: "01", title: "挑一個情境", body: "從九個日常與職場情境中選一個，決定今天要練的場面。" },
  { n: "02", title: "開口對話", body: "打字或說話都行，家教以角色身分回應，把對話撐到底。" },
  { n: "03", title: "收下回饋", body: "對話結束給你一份重點回顧：說得好的地方、可以再更自然的講法。" },
];

export const dynamic = "force-dynamic";

export default function Home() {
  const scenarios = listScenarios();
  return (
    <>
      <SiteHeader />

      <main className="flex-1">
        {/* Hero ---------------------------------------------------- */}
        <section className="relative overflow-hidden px-5 pt-16 pb-20 sm:px-8 sm:pt-24 sm:pb-28">
          <div
            aria-hidden
            className="glow pointer-events-none absolute top-[-16rem] left-1/2 h-[34rem] w-[34rem] -translate-x-1/2 rounded-full bg-clay/15 blur-[120px]"
          />

          <div className="relative mx-auto flex w-full max-w-2xl flex-col items-center text-center">
            <span className="rise inline-flex items-center gap-2 rounded-full border border-line bg-surface px-3.5 py-1.5 text-[13px] text-ink-soft">
              <Mark className="h-3.5 w-3.5 text-clay" />
              英文口說練習 · 由 Gemini 驅動
            </span>

            <h1 className="rise mt-7 font-display text-[42px] leading-[1.12] font-normal tracking-[-0.02em] text-balance sm:text-[58px] [animation-delay:80ms]">
              把英文,
              <br />
              練到能<span className="text-clay">開口</span>。
            </h1>

            <p className="rise mt-6 max-w-lg text-[17px] leading-8 text-ink-soft text-balance [animation-delay:160ms]">
              和 AI 英文家教進行真實情境的對話練習。它扮演店員、面試官、醫生，
              陪你把每一句話說完整。
            </p>

            <div className="rise mt-9 flex flex-col items-center gap-3 [animation-delay:240ms] sm:flex-row">
              <Link
                href="/scenarios"
                className="group inline-flex h-13 items-center gap-2 rounded-full bg-clay px-7 text-[16px] font-medium text-on-clay shadow-[var(--shadow)] transition-colors hover:bg-clay-deep"
              >
                Let&apos;s Chat
                <span className="transition-transform duration-300 group-hover:translate-x-1">
                  →
                </span>
              </Link>
              <Link
                href="#how"
                className="inline-flex h-13 items-center rounded-full px-6 text-[15px] text-ink-soft transition-colors hover:text-ink"
              >
                先看看怎麼運作
              </Link>
            </div>

            <div className="rise mt-14 w-full [animation-delay:320ms]">
              <HeroComposer />
              <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
                {scenarios.slice(0, 4).map((s) => (
                  <Link
                    key={s.id}
                    href={`/chat/${s.id}`}
                    className="inline-flex items-center gap-1.5 rounded-full border border-line bg-surface px-3.5 py-2 text-[13px] text-ink-soft transition-colors hover:border-line-strong hover:text-ink"
                  >
                    <span>{s.emoji}</span>
                    {s.titleZh}
                  </Link>
                ))}
                <Link
                  href="/scenarios"
                  className="rounded-full px-3 py-2 text-[13px] text-clay transition-opacity hover:opacity-75"
                >
                  更多情境 →
                </Link>
              </div>
            </div>
          </div>
        </section>

        {/* Features ------------------------------------------------ */}
        <section className="border-t border-line/70 bg-canvas-deep px-5 py-20 sm:px-8">
          <div className="mx-auto w-full max-w-6xl">
            <h2 className="font-display text-[28px] tracking-tight sm:text-[32px]">
              練口說最難的不是單字，是敢說。
            </h2>
            <p className="mt-3 max-w-xl text-[15px] leading-7 text-ink-soft">
              Fluently 把「找人陪你講英文」這件事變成隨時能開始的一件小事。
            </p>

            <div className="mt-10 grid gap-4 md:grid-cols-3">
              {FEATURES.map((f) => (
                <div
                  key={f.title}
                  className="rounded-2xl border border-line bg-surface p-6"
                >
                  <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-clay-wash text-[20px]">
                    {f.icon}
                  </span>
                  <h3 className="mt-4 font-display text-[19px] tracking-tight">
                    {f.title}
                  </h3>
                  <p className="mt-2 text-[14px] leading-7 text-ink-soft">
                    {f.body}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* How it works -------------------------------------------- */}
        <section
          id="how"
          className="scroll-mt-20 border-t border-line/70 px-5 py-20 sm:px-8"
        >
          <div className="mx-auto grid w-full max-w-6xl gap-12 lg:grid-cols-[minmax(0,22rem)_1fr]">
            <div>
              <h2 className="font-display text-[28px] tracking-tight sm:text-[32px]">
                怎麼練？
              </h2>
              <p className="mt-3 text-[15px] leading-7 text-ink-soft">
                三個步驟，一次十分鐘。不用約時間、不用怕說錯。
              </p>
              <Link
                href="/scenarios"
                className="mt-6 inline-flex items-center gap-1.5 text-[15px] font-medium text-clay transition-opacity hover:opacity-75"
              >
                挑一個情境開始 →
              </Link>
            </div>

            <ol className="grid gap-px overflow-hidden rounded-2xl border border-line bg-line sm:grid-cols-3">
              {STEPS.map((s) => (
                <li key={s.n} className="bg-surface p-6">
                  <span className="font-mono text-[13px] text-clay">{s.n}</span>
                  <h3 className="mt-3 font-display text-[18px] tracking-tight">
                    {s.title}
                  </h3>
                  <p className="mt-2 text-[14px] leading-7 text-ink-soft">
                    {s.body}
                  </p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        {/* Closing CTA --------------------------------------------- */}
        <section className="border-t border-line/70 bg-canvas-deep px-5 py-20 sm:px-8">
          <div className="mx-auto flex w-full max-w-3xl flex-col items-center rounded-3xl border border-line bg-surface px-6 py-14 text-center">
            <Mark className="h-8 w-8 text-clay" />
            <h2 className="mt-5 font-display text-[30px] leading-tight tracking-tight text-balance sm:text-[36px]">
              今天就說第一句。
            </h2>
            <p className="mt-3 max-w-md text-[15px] leading-7 text-ink-soft text-balance">
              沒有評分、沒有觀眾，只有一個很有耐心的家教。
            </p>
            <Link
              href="/scenarios"
              className="group mt-8 inline-flex h-13 items-center gap-2 rounded-full bg-clay px-7 text-[16px] font-medium text-on-clay transition-colors hover:bg-clay-deep"
            >
              Let&apos;s Chat
              <span className="transition-transform duration-300 group-hover:translate-x-1">
                →
              </span>
            </Link>
          </div>
        </section>
      </main>

      <SiteFooter />
    </>
  );
}
