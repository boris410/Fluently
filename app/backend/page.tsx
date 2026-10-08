import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { BackendShell } from "@/components/backend-shell";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { getCurrentUser } from "@/lib/current-user";
import { defaultVoiceId } from "@/lib/db";

export const metadata: Metadata = {
  title: "後台 — Fluently",
  description:
    "在左側選項目來調整 Gemini key、家教聲音與外觀，或查看用量、紀錄、音色目錄與 TTS。",
};

export const dynamic = "force-dynamic";

export default async function BackendPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const configured = Boolean(process.env.ELEVENLABS_API_KEY?.trim());
  const voiceId = await defaultVoiceId();

  return (
    <>
      <SiteHeader compact />

      <main className="flex-1 px-5 py-14 sm:px-8 sm:py-16">
        <div className="mx-auto w-full max-w-6xl">
          <h1 className="rise font-display text-[36px] leading-tight tracking-[-0.02em] sm:text-[44px]">
            後台
          </h1>
          <p className="rise mt-3 max-w-2xl text-[16px] leading-7 text-ink-soft [animation-delay:80ms]">
            在左側選項目來調整 Gemini key、家教聲音與外觀，或查看用量、紀錄、音色目錄與 TTS。Gemini key 與聲音偏好只存在這個瀏覽器，不會寫進資料庫。
          </p>

          <div className="rise mt-10 [animation-delay:140ms]">
            <BackendShell configured={configured} voiceId={voiceId} />
          </div>
        </div>
      </main>

      <SiteFooter />
    </>
  );
}
