import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ExternalLink } from "lucide-react";
import { IconImage } from "@/components/icon-image";
import { MusicianDetailActions } from "@/components/musician-detail-actions";
import { Badge } from "@/components/ui/badge";
import { getMusicianBySlug } from "@/lib/data/musicians";
import { displayUrl } from "@/lib/utils/sns";
import { musicianProfileUrl } from "@/lib/utils/url";

export const revalidate = 300;

type PageProps = { params: Promise<{ slug: string }> };

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const musician = await getMusicianBySlug(slug);
  if (!musician) return { title: "Musician not found" };
  const description = `${musician.nameEn}${
    musician.roles.length > 0 ? ` — ${musician.roles.join(" / ")}` : ""
  } | EMN Records Musician Directory`;
  return {
    title: musician.displayName,
    description,
    openGraph: {
      title: `${musician.displayName} | EMN Records Musicians`,
      description,
      url: musicianProfileUrl(musician.slug),
      ...(musician.iconImageUrl
        ? { images: [{ url: musician.iconImageUrl }] }
        : {}),
    },
  };
}

export default async function MusicianDetailPage({ params }: PageProps) {
  const { slug } = await params;
  const musician = await getMusicianBySlug(slug);
  if (!musician) notFound();

  const links = musician.links.filter((l) => l.isPublic);

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-8">
      <Link
        href="/musicians"
        className="flex items-center gap-1 text-xs text-muted hover:text-ink"
      >
        <ArrowLeft className="size-3.5" />
        Musicians
      </Link>

      <div className="flex flex-col gap-6 sm:flex-row sm:items-start">
        <div className="w-40 shrink-0 sm:w-48">
          <IconImage
            src={musician.iconImageUrl}
            name={musician.displayName}
            initialsSource={musician.nameEn}
            className="rounded-2xl"
          />
        </div>
        <div className="flex min-w-0 flex-1 flex-col gap-4">
          <div className="flex flex-col gap-1">
            <h1 className="text-2xl font-semibold tracking-tight">
              {musician.displayName}
            </h1>
            <p className="text-sm text-muted">
              {musician.nameJp}
              {musician.nameEn !== "" ? ` / ${musician.nameEn}` : ""}
            </p>
          </div>

          {musician.roles.length > 0 ? (
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-xs text-muted">Role:</span>
              {musician.roles.map((role) => (
                <Badge key={role}>{role}</Badge>
              ))}
            </div>
          ) : null}

          <dl className="flex flex-col gap-1.5 text-sm">
            {musician.primarySnsUrl ? (
              <LinkRow label="SNS" url={musician.primarySnsUrl} />
            ) : null}
            {musician.websiteUrl ? (
              <LinkRow label="Web" url={musician.websiteUrl} />
            ) : null}
            {links
              .filter(
                (l) =>
                  l.url !== musician.primarySnsUrl &&
                  l.url !== musician.websiteUrl,
              )
              .map((l) => (
                <LinkRow
                  key={l.id}
                  label={l.label ?? l.platform}
                  url={l.url}
                />
              ))}
            {musician.vrcName ? (
              <div className="flex items-baseline gap-2">
                <dt className="w-14 shrink-0 text-xs uppercase tracking-wide text-muted">
                  VRChat
                </dt>
                <dd className="text-ink">{musician.vrcName}</dd>
              </div>
            ) : null}
          </dl>

          <MusicianDetailActions musician={musician} />
        </div>
      </div>

    </div>
  );
}

function LinkRow({ label, url }: { label: string; url: string }) {
  return (
    <div className="flex items-baseline gap-2">
      <dt className="w-14 shrink-0 text-xs uppercase tracking-wide text-muted">
        {label}
      </dt>
      <dd className="min-w-0">
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex max-w-full items-center gap-1 truncate text-ink underline-offset-2 hover:text-accent-strong hover:underline"
        >
          <span className="truncate">{displayUrl(url)}</span>
          <ExternalLink className="size-3 shrink-0 text-muted" />
        </a>
      </dd>
    </div>
  );
}
