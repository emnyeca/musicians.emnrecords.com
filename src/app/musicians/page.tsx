import type { Metadata } from "next";
import { MusicianDirectory } from "@/components/musician-grid";
import { getPublicMusicians } from "@/lib/data/musicians";

export const metadata: Metadata = {
  title: "Musicians",
  description:
    "Virtual musicians around EMN Records — roles, links and profiles.",
};

export const revalidate = 300;

export default async function MusiciansPage() {
  const musicians = await getPublicMusicians();

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-xl font-semibold tracking-tight">Musicians</h1>
        <p className="text-sm text-muted">
          EMN Recordsに関わるバーチャルミュージシャンの名鑑
        </p>
      </div>
      <MusicianDirectory musicians={musicians} />
    </div>
  );
}
