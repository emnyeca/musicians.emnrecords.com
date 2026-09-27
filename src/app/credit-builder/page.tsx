import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { CreditBuilderForm } from "@/components/credit-builder-form";

export const metadata: Metadata = {
  title: "Credit Builder",
  description: "Build event credits from EMN Records members and guests.",
  robots: { index: false },
};

export default function CreditBuilderPage() {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <Link
          href="/musicians"
          className="mb-2 flex w-fit items-center gap-1 text-xs text-muted hover:text-ink"
        >
          <ArrowLeft className="size-3.5" />
          Musicians
        </Link>
        <h1 className="text-xl font-semibold tracking-tight">Credit Builder</h1>
        <p className="text-sm text-muted">
          出演者・スタッフ・ゲストを選び、イベント用のクレジットを作成します。
        </p>
      </div>
      <CreditBuilderForm />
    </div>
  );
}
