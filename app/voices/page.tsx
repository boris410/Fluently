import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { VoiceCatalog } from "@/components/voice-catalog";
import { getCurrentUser } from "@/lib/current-user";
import { listCharacters, listVoices } from "@/lib/db";

export const metadata: Metadata = {
  title: "音色目錄 — Fluently",
  description: "全域的 ElevenLabs 音色與人物指派。",
};

export const dynamic = "force-dynamic";

export default async function VoicesPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const [voiceRows, characterRows] = await Promise.all([
    listVoices(),
    listCharacters(),
  ]);
  const initialVoices = voiceRows.map((row) => ({
    id: row.id,
    voiceId: row.voice_id,
    label: row.label,
    isFree: row.is_free === 1,
  }));
  const initialCharacters = characterRows.map((row) => ({
    id: row.id,
    name: row.name,
    elevenlabsVoiceId: row.elevenlabs_voice_id,
  }));

  return (
    <>
      <SiteHeader compact />

      <main className="flex-1 px-5 py-14 sm:px-8 sm:py-16">
        <div className="mx-auto w-full max-w-3xl">
          <Link
            href="/tts"
            className="text-[13px] text-ink-muted transition-colors hover:text-ink"
          >
            ← ElevenLabs TTS 測試
          </Link>

          <h1 className="rise mt-5 font-display text-[36px] leading-tight tracking-[-0.02em] sm:text-[44px]">
            音色目錄
          </h1>
          <p className="rise mt-3 max-w-2xl text-[16px] leading-7 text-ink-soft [animation-delay:80ms]">
            全域的 ElevenLabs 音色與人物指派。登入者看到的是同一份目錄，改了會影響之後所有練習的角色聲音。
          </p>

          <div className="rise mt-10 [animation-delay:140ms]">
            <VoiceCatalog
              initialVoices={initialVoices}
              initialCharacters={initialCharacters}
            />
          </div>
        </div>
      </main>

      <SiteFooter />
    </>
  );
}
