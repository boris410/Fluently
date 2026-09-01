import { Mark } from "@/components/logo";

export function SiteFooter() {
  return (
    <footer className="border-t border-line/70 px-5 py-10 sm:px-8">
      <div className="mx-auto flex w-full max-w-6xl flex-col items-center justify-between gap-4 text-[13px] text-ink-muted sm:flex-row">
        <div className="flex items-center gap-2">
          <Mark className="h-4 w-4 text-clay" />
          <span>Fluently — 你的 AI 英文口說夥伴</span>
        </div>
        <p>對話由 Gemini 驅動 · 進度存在你自己的 SQLite</p>
      </div>
    </footer>
  );
}
