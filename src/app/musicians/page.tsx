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
        <h1 className="text-xl font-semibold tracking-tight">Musicians</h1>
        <p className="text-sm text-muted">
          EMN Recordsに関わるバーチャルミュージシャンの名鑑
        </p>
      </div>
      <LiveDirectory />
    </div>
  );
}
