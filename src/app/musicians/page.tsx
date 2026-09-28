import type { Metadata } from "next";
import { LiveDirectory } from "@/components/live-directory";

export const metadata: Metadata = {
  title: "Musicians",
  description:
    "Virtual musicians around EMN Records — roles, links and profiles.",
};


export default function MusiciansPage() {

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-xl font-semibold tracking-tight">バーチャルミュージシャン名鑑 by EMN Records</h1>
        <p className="text-sm text-muted">
          バーチャルで活躍するミュージシャンと、音楽を支えるクリエイター・スタッフを紹介します。
        </p>
      </div>
      <LiveDirectory />
    </div>
  );
}
