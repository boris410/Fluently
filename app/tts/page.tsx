import type { Metadata } from "next";
import Link from "next/link";
import { ElevenLabsTtsTester } from "@/components/elevenlabs-tts-tester";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { defaultVoiceId } from "@/lib/db";

export const metadata: Metadata = {
  title: "ElevenLabs TTS 測試 — Fluently",
  description: "用 ElevenLabs 合成一句英文，確認音色與延遲。",
};

export const dynamic = "force-dynamic";

export default async function TtsPage() {
  const configured = Boolean(process.env.ELEVENLABS_API_KEY?.trim());
  const voiceId = await defaultVoiceId();

  return (
    <>
      <SiteHeader compact />

      <main className="flex-1 px-5 py-14 sm:px-8 sm:py-16">
        <div className="mx-auto w-full max-w-3xl">
          <Link
            href="/logs"
            className="text-[13px] text-ink-muted transition-colors hover:text-ink"
          >
            ← API 呼叫紀錄
          </Link>

          <h1 className="mt-5 font-display text-[36px] leading-tight tracking-[-0.02em] sm:text-[44px]">
            ElevenLabs TTS
          </h1>
          <p className="mt-3 max-w-2xl text-[16px] leading-7 text-ink-soft">
            測試介面。Key 只存在伺服器的
            <code className="mx-1 font-mono text-[14px]">.env.local</code>
            ，瀏覽器打的是我們自己的
            <code className="mx-1 font-mono text-[14px]">/api/elevenlabs</code>
            ，不會把 key 送到前端。
          </p>

          <div className="mt-10">
            <ElevenLabsTtsTester
              configured={configured}
              voiceId={voiceId}
            />
          </div>
        </div>
      </main>

      <SiteFooter />
    </>
  );
}
