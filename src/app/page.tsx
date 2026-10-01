"use client";
import { useTranslation } from "@/lib/i18n";

import Image from "next/image";
import Link from "next/link";
import { ArrowUpRight, Headphones, ListMusic, Music2 } from "lucide-react";
import { MusicianCount } from "@/components/live-directory";
import { releaseLabel, version } from "../../package.json";

const discordGuide = "https://emnrecords.com/emn-records-discord-%e4%b8%80%e8%88%ac%e5%85%ac%e9%96%8b%e3%81%ae%e3%81%8a%e7%9f%a5%e3%82%89%e3%81%9b/";
const uses = [
  { icon: Headphones, audience: "音楽を楽しむ方へ", title: "気になる人を探してみる", text: "ライブで出会った名前や、好きな楽器から探してみる。関連リンクを通じてもっと知る。", href: "/musicians", link: "活動者を探す" },
  { icon: ListMusic, audience: "イベント・作品をつくる方へ", title: "一緒に作った人に感謝を伝える。", text: "きちんとしたクレジットは共演者やスタッフへの感謝の気持ち。名鑑では、本人が登録した情報から、色々なフォーマットでクレジットをまとめられます。また、名鑑にいないゲストは自分だけのリストに追加して、次回以降も使用できます。", href: "/credit-builder", link: "クレジットをつくる" },
  { icon: Music2, audience: "バーチャルで活動する方へ", title: "あなたの活動を届けてください", text: "担当や活動先のプロフィールとして。登録後はDiscordからいつでも編集できます。共演する方や聴いてくれる方へご自身の活動をぜひ紹介してください。", href: "#join", link: "登録について" },
];

export default function HomePage() {
  const t = useTranslation();
  return (
    <div className="space-y-20 pb-8 sm:space-y-24">
      <section className="mx-auto max-w-2xl pt-5 text-center lg:pt-12" aria-labelledby="home-title">
        <div>
          <p className="mb-5 text-xs font-semibold tracking-[0.2em] text-[#843c59]">MUSIC, PEOPLE & CONNECTIONS</p>
          <h1 id="home-title" className="text-3xl font-semibold leading-[1.5] tracking-tight sm:text-4xl">{t("バーチャル")}<br />{t("ミュージシャン名鑑")}</h1>
          <p className="mt-3 text-sm tracking-widest text-muted">by EMN Records</p>
          <p className="mx-auto mt-6 max-w-lg text-sm leading-8 text-muted">{t("バーチャルで活躍するミュージシャンと、音楽を支えるクリエイター・スタッフを紹介します。クレジット作成では、外部のゲストも追加できます。")}</p>
          <div className="mt-7 flex flex-wrap justify-center items-center gap-5">
            <Link href="/musicians" className="rounded-full bg-ink px-6 py-3 text-sm font-medium text-white transition-colors hover:bg-[#843c59]">{t("名鑑を見る")}<span aria-hidden="true">→</span></Link>
            <Link href="/credit-builder" className="text-sm underline decoration-accent underline-offset-4 hover:text-[#843c59]">{t("クレジットをつくる")}</Link>
          </div>
          <div className="mt-5 text-xs text-muted"><MusicianCount /></div>
        </div>
      </section>

      <section id="join" className="scroll-mt-8 overflow-hidden rounded-2xl border border-line bg-accent-soft" aria-labelledby="join-title">
        <div className="grid md:grid-cols-[0.7fr_1fr]">
          <Image src="/images/top/virtual-session.webp" alt={t("明るいバーチャル空間で楽器を囲むセッションの参加者たち")} width={1000} height={563} className="h-full max-h-72 w-full object-cover md:max-h-none" />
          <div className="p-6 sm:p-9">
            <p className="text-xs font-medium tracking-widest text-[#843c59]">FOR ARTISTS & CREATORS</p>
            <h2 id="join-title" className="mt-3 text-xl font-semibold sm:text-2xl">{t("ご登録について")}</h2>
            <p className="mt-4 text-sm leading-7">{t("演奏する方も、支える方もご登録を歓迎します。")}</p>
            <ol className="mt-5 space-y-3 text-sm leading-6">
              <li><span className="mr-2 font-semibold text-[#843c59]">01</span>{t("EMN RecordsのDiscordサーバーに参加。")}</li>
              <li><span className="mr-2 font-semibold text-[#843c59]">02</span>{t("最初の質問、または「チャンネル＆ロール」で「Memberとして関わる」を選択。")}</li>
              <li><span className="mr-2 font-semibold text-[#843c59]">03</span>{t("運営がご活動を確認次第、メンバーロールを付与しますので、名鑑専用チャンネルから登録・編集できます。")}</li>
            </ol>
            <a href={discordGuide} className="mt-6 inline-flex items-center gap-2 text-sm font-medium text-[#843c59] underline underline-offset-4">{t("Discordへの参加案内")}<ArrowUpRight size={16} aria-hidden="true" /></a>
          </div>
        </div>
      </section>

      <section aria-labelledby="uses-title">
        <p className="text-xs font-medium tracking-widest text-[#843c59]">DISCOVER / CREATE / CONNECT</p>
        <h2 id="uses-title" className="mt-3 text-2xl font-semibold">{t("ミュージシャン名鑑 by EMN Recordsについて")}</h2>
        <div className="mt-8 grid gap-8 md:grid-cols-3">
          {uses.map(({ icon: Icon, audience, title, text, href, link }) => (
            <article key={t(title)} className="border-t border-line pt-6">
              <Icon className="mb-5 text-[#843c59]" size={25} strokeWidth={1.5} aria-hidden="true" />
              <p className="text-xs text-muted">{t(audience)}</p>
              <h3 className="mt-2 text-lg font-semibold">{t(title)}</h3>
              <p className="mt-3 text-sm leading-7 text-muted">{t(text)}</p>
              <Link href={href} className="mt-5 inline-block text-sm font-medium underline decoration-accent underline-offset-4 hover:text-[#843c59]">{t(link)} <span aria-hidden="true">→</span></Link>
            </article>
          ))}
        </div>
      </section>

      {/* Release record: package.json version/releaseLabel, updated on every production deploy. */}
      <p className="text-[11px] text-muted/70">version {version} {releaseLabel}</p>
    </div>
  );
}
