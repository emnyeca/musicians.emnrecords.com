import Link from "next/link";
import { getPublicMusicians } from "@/lib/data/musicians";

export default async function HomePage() {
  const musicians = await getPublicMusicians();

  return (
    <div className="flex flex-col items-center gap-8 py-16 text-center sm:py-24">
      <div className="flex flex-col gap-3">
        <p className="text-xs font-medium tracking-[0.3em] text-muted">
          EMN RECORDS
        </p>
        <h1 className="text-3xl font-semibold tracking-tight text-ink sm:text-4xl">
          Musician Directory
        </h1>
        <p className="mx-auto max-w-md text-sm leading-relaxed text-muted">
          A public directory of virtual musicians around EMN Records. Find
          performers, follow their links, and build event credits in seconds.
        </p>
      </div>
      <Link
        href="/musicians"
        className="inline-flex h-11 items-center rounded-md bg-ink px-6 text-sm font-medium text-white transition-opacity hover:opacity-85"
      >
        Browse musicians
      </Link>
      <p className="text-xs text-muted">{musicians.length} musicians listed</p>
    </div>
  );
}
