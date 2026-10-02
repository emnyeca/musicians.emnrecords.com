import type { Metadata } from "next";
import { MemberProfileEditor } from "@/components/member-profile-editor";

export const metadata: Metadata = {
  title: "Your profile",
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};

export default function MemberPage() {
  return <MemberProfileEditor />;
}
