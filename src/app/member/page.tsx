import type { Metadata } from "next";
import { MemberProfileEditor } from "@/components/member-profile-editor";

export const metadata: Metadata = {
  title: "自分のプロフィール | EMN Records",
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};

export default function MemberPage() {
  return <MemberProfileEditor />;
}
