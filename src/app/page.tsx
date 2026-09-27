import Link from "next/link";
import { MusicianCount } from "@/components/live-directory";

export default function HomePage() {

  return (
    <div className="flex flex-col items-center gap-8 py-16 text-center sm:py-24">
      <div className="flex flex-col gap-3">
        <p className="text-xs font-medium tracking-[0.3em] text-muted">
          EMN RECORDS
        </p>
        <h1 className="text-3xl font-semibold tracking-tight text-ink sm:text-4xl">
          バーチャルミュージシャン名鑑
        </h1>
        <p className="mx-auto max-w-md text-sm leading-relaxed text-muted">
          EMN Recordsのミュージシャンと、音楽を支えるクリエイター・スタッフを紹介します。
          クレジット作成では、外部のゲストも追加できます。
        </p>
      </div>
      <Link
        href="/musicians"
        className="inline-flex h-11 items-center rounded-md bg-ink px-6 text-sm font-medium text-white transition-opacity hover:opacity-85"
      >
        Browse musicians
      </Link>
      <MusicianCount />
    </div>
  );
}
