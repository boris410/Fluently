import Link from "next/link";
import { Wordmark } from "@/components/logo";
import { SettingsMenu } from "@/components/settings-menu";
import { UserMenu } from "@/components/user-menu";

export function SiteHeader({ compact = false }: { compact?: boolean }) {
  return (
    <header className="sticky top-0 z-30 border-b border-line/70 bg-canvas/80 backdrop-blur-md">
      <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between px-5 sm:px-8">
        <Wordmark />
        <nav className="flex items-center gap-1 text-[14px] text-ink-soft">
          {!compact && (
            <>
              <Link
                href="/scenarios"
                className="hidden rounded-lg px-3 py-2 transition-colors hover:bg-surface-2 hover:text-ink sm:block"
              >
                情境
              </Link>
              <Link
                href="/#how"
                className="hidden rounded-lg px-3 py-2 transition-colors hover:bg-surface-2 hover:text-ink sm:block"
              >
                怎麼練
              </Link>
            </>
          )}
          <SettingsMenu />
          <UserMenu />
        </nav>
      </div>
    </header>
  );
}
