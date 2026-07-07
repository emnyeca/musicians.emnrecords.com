import Link from "next/link";

export function SiteHeader() {
  return (
    <header className="border-b border-line bg-background">
      <div className="mx-auto flex h-14 w-full max-w-6xl items-center justify-between px-4 sm:px-6">
        <Link href="/" className="flex items-baseline gap-2">
          <span className="text-sm font-semibold tracking-[0.18em] text-ink">
            EMN RECORDS
          </span>
          <span className="hidden text-xs tracking-wide text-muted sm:inline">
            Musician Directory
          </span>
        </Link>
        <nav className="flex items-center gap-5 text-sm">
          <Link href="/musicians" className="text-muted transition-colors hover:text-ink">
            Musicians
          </Link>
        </nav>
      </div>
    </header>
  );
}
