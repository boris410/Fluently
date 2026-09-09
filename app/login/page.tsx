import type { Metadata } from "next";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { Mark } from "@/components/logo";
import { GoogleSignIn } from "@/components/google-sign-in";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { getCurrentUser } from "@/lib/current-user";

export const metadata: Metadata = {
  title: "登入 — Fluently",
  description: "使用 Google 登入，開始你的英文口說練習。",
};

export const dynamic = "force-dynamic";

export default async function LoginPage() {
  const cookieStore = await cookies();
  const hasSessionCookie =
    cookieStore.has("better-auth.session_token") ||
    cookieStore.has("__Secure-better-auth.session_token");
  // Skip D1 unless a session cookie exists, so a flaky auth lookup cannot
  // 500 the whole login screen.
  if (hasSessionCookie) {
    const user = await getCurrentUser();
    if (user) redirect("/scenarios");
  }

  return (
    <>
      <SiteHeader compact />

      <main className="flex flex-1 items-center justify-center px-5 py-16 sm:px-8">
        <div className="w-full max-w-sm text-center">
          <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-clay-wash">
            <Mark className="h-6 w-6 text-clay" />
          </span>

          <h1 className="mt-6 font-display text-[30px] leading-tight tracking-[-0.02em]">
            登入 Fluently
          </h1>
          <p className="mt-3 text-[15px] leading-7 text-ink-soft">
            對話紀錄與用量都綁在你的帳號，登入後只有你看得到。
          </p>

          <div className="mt-8">
            <Suspense
              fallback={
                <div className="h-13 w-full rounded-full border border-line bg-surface-2" />
              }
            >
              <GoogleSignIn />
            </Suspense>
          </div>

          <p className="mt-6 text-[12px] leading-5 text-ink-muted">
            登入即表示你同意我們僅為了辨識身分而讀取你的 Google 名稱、Email
            與頭像。
          </p>
        </div>
      </main>

      <SiteFooter />
    </>
  );
}
