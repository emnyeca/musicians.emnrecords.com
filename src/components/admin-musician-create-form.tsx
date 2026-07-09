"use client";

import { useState, type FormEvent, type ReactNode } from "react";
import Link from "next/link";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

type CreateResult =
  | { ok: true; musician: { slug: string; url: string } }
  | { ok: false; error: string };

export function AdminMusicianCreateForm({
  disabled,
}: {
  disabled: boolean;
}) {
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<CreateResult | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (disabled) return;
    setSubmitting(true);
    setResult(null);

    const form = event.currentTarget;
    const data = new FormData(form);
    const payload = {
      slug: data.get("slug"),
      displayName: data.get("displayName"),
      nameJp: data.get("nameJp"),
      nameEn: data.get("nameEn"),
      canonicalName: data.get("canonicalName"),
      sortName: data.get("sortName"),
      aliases: data.get("aliases"),
      roles: data.get("roles"),
      primarySnsUrl: data.get("primarySnsUrl"),
      websiteUrl: data.get("websiteUrl"),
      iconImageUrl: data.get("iconImageUrl"),
      vrcName: data.get("vrcName"),
      discordName: data.get("discordName"),
      visibility: data.get("visibility"),
      isVerified: data.get("isVerified") === "on",
      links: data.get("links"),
    };

    try {
      const response = await fetch("/api/admin/musicians", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const body = (await response.json()) as CreateResult;
      setResult(body);
      if (body.ok) form.reset();
    } catch {
      setResult({ ok: false, error: "通信に失敗しました。" });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-5">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="表示名 *" htmlFor="admin-display-name">
          <Input id="admin-display-name" name="displayName" required />
        </Field>
        <Field label="slug" htmlFor="admin-slug">
          <Input
            id="admin-slug"
            name="slug"
            placeholder="未入力なら英語名から生成"
          />
        </Field>
        <Field label="日本語名 *" htmlFor="admin-name-jp">
          <Input id="admin-name-jp" name="nameJp" required />
        </Field>
        <Field label="英語名 *" htmlFor="admin-name-en">
          <Input id="admin-name-en" name="nameEn" required />
        </Field>
        <Field label="正規名" htmlFor="admin-canonical-name">
          <Input id="admin-canonical-name" name="canonicalName" />
        </Field>
        <Field label="並び順名" htmlFor="admin-sort-name">
          <Input id="admin-sort-name" name="sortName" />
        </Field>
      </div>

      <Field label="担当 *" htmlFor="admin-roles">
        <Textarea
          id="admin-roles"
          name="roles"
          required
          rows={3}
          placeholder="Vocal, Guitar"
        />
      </Field>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="主SNS URL" htmlFor="admin-primary-sns-url">
          <Input id="admin-primary-sns-url" name="primarySnsUrl" type="url" />
        </Field>
        <Field label="Web URL" htmlFor="admin-website-url">
          <Input id="admin-website-url" name="websiteUrl" type="url" />
        </Field>
      </div>

      <Field label="追加リンク" htmlFor="admin-links">
        <Textarea
          id="admin-links"
          name="links"
          rows={4}
          placeholder={
            "YouTube | https://youtube.com/@example\nhttps://soundcloud.com/example"
          }
        />
      </Field>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="アイコンURL" htmlFor="admin-icon-image-url">
          <Input id="admin-icon-image-url" name="iconImageUrl" type="url" />
        </Field>
        <Field label="別名" htmlFor="admin-aliases">
          <Input id="admin-aliases" name="aliases" placeholder="comma separated" />
        </Field>
        <Field label="VRChat名" htmlFor="admin-vrc-name">
          <Input id="admin-vrc-name" name="vrcName" />
        </Field>
        <Field label="Discord名" htmlFor="admin-discord-name">
          <Input id="admin-discord-name" name="discordName" />
        </Field>
      </div>

      <div className="flex flex-wrap items-end gap-4">
        <Field label="公開状態" htmlFor="admin-visibility">
          <Select id="admin-visibility" name="visibility" defaultValue="draft">
            <option value="draft">draft</option>
            <option value="public">public</option>
            <option value="hidden">hidden</option>
          </Select>
        </Field>
        <label className="flex h-10 items-center gap-2 text-sm text-ink">
          <input
            type="checkbox"
            name="isVerified"
            className="size-4 accent-[var(--color-accent-strong)]"
          />
          verified
        </label>
      </div>

      {result ? (
        result.ok ? (
          <p className="text-sm text-muted">
            作成しました:{" "}
            <Link
              href={result.musician.url}
              className="text-ink underline-offset-2 hover:underline"
            >
              {result.musician.slug}
            </Link>
          </p>
        ) : (
          <p className="text-sm text-red-600">{result.error}</p>
        )
      ) : null}

      <div>
        <Button type="submit" variant="solid" disabled={disabled || submitting}>
          <Plus className="size-4" />
          {submitting ? "作成中..." : "ミュージシャンを追加"}
        </Button>
      </div>
    </form>
  );
}

function Field({
  label,
  htmlFor,
  children,
}: {
  label: string;
  htmlFor: string;
  children: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={htmlFor}>{label}</Label>
      {children}
    </div>
  );
}
