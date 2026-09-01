import Link from "next/link";

export function Mark({ className = "" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 32 32"
      aria-hidden
      className={className}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d="M16 3.5c6.9 0 12.5 4.7 12.5 10.6 0 5.8-5.6 10.5-12.5 10.5-1.3 0-2.6-.16-3.8-.47l-6.2 3.1a.6.6 0 0 1-.86-.63l.86-5.2C3.2 19.6 3.5 17.1 3.5 14.1 3.5 8.2 9.1 3.5 16 3.5Z"
        fill="currentColor"
        opacity=".13"
      />
      <path
        d="M16 3.5c6.9 0 12.5 4.7 12.5 10.6 0 5.8-5.6 10.5-12.5 10.5-1.3 0-2.6-.16-3.8-.47l-6.2 3.1a.6.6 0 0 1-.86-.63l.86-5.2C3.2 19.6 3.5 17.1 3.5 14.1 3.5 8.2 9.1 3.5 16 3.5Z"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinejoin="round"
      />
      <path
        d="M16 8.4c.4 2.7 1.2 4.3 2.5 5s-.1.2-2.5 5.2c-2.4-5-1.2-4.5-2.5-5.2s2.1-2.3 2.5-5Z"
        fill="currentColor"
      />
    </svg>
  );
}

export function Wordmark({ href = "/" }: { href?: string }) {
  return (
    <Link
      href={href}
      className="group inline-flex items-center gap-2.5 text-ink transition-opacity hover:opacity-80"
    >
      <Mark className="h-7 w-7 text-clay transition-transform duration-500 group-hover:rotate-6" />
      <span className="font-display text-[19px] leading-none font-medium tracking-tight">
        Fluently
      </span>
    </Link>
  );
}
