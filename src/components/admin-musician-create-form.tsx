"use client";
import { useTranslation } from "@/lib/i18n";

import { useState, type FormEvent, type ReactNode } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { RolePicker, roleValues } from "./role-picker";

type CreateResult =
  | { ok: true; musician: { slug: string; url: string } }
  | { ok: false; error: string };

export function AdminMusicianCreateForm({
  disabled,
}: {
  disabled: boolean;
}) {
  const t = useTranslation();
  const [submitting, setSubmitting] = useState(false);
  const [roles, setRoles] = useState<string[]>([]);
  const [otherRole, setOtherRole] = useState("");
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
      roles: roleValues(roles, otherRole),
      roleChoices: roles, otherRole,
      directoryCategories: [data.get("directoryCategory")],
      primarySnsUrl: data.get("primarySnsUrl"),
      websiteUrl: data.get("websiteUrl"),
      iconImageUrl: data.get("iconImageUrl"),
      vrcName: data.get("vrcName"),
      discordName: data.get("discordName"),
      visibility: data.get("visibility"),
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
      if (body.ok) { form.reset(); setRoles([]); setOtherRole(""); }
    } catch {
      setResult({ ok: false, error: "通信に失敗しました。" });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-5">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label={t("表示名 *")} htmlFor="admin-display-name">
          <Input id="admin-display-name" name="displayName" required />
        </Field>
        <Field label="slug" htmlFor="admin-slug">
          <Input
            id="admin-slug"
            name="slug"
            placeholder={t("未入力なら英語名から生成")}
          />
        </Field>
        <Field label={t("日本語名（任意）")} htmlFor="admin-name-jp">
          <Input id="admin-name-jp" name="nameJp" />
        </Field>
        <Field label={t("英語名 *")} htmlFor="admin-name-en">
          <Input id="admin-name-en" name="nameEn" required />
        </Field>
        <Field label={t("正規名")} htmlFor="admin-canonical-name">
          <Input id="admin-canonical-name" name="canonicalName" />
        </Field>
        <Field label={t("並び順名")} htmlFor="admin-sort-name">
          <Input id="admin-sort-name" name="sortName" />
        </Field>
      </div>

      <RolePicker roles={roles} otherRole={otherRole} onChange={(values, other) => { setRoles(values); setOtherRole(other); }} />
      <Field label={t("名鑑の活動区分")} htmlFor="admin-category">
        <Select id="admin-category" name="directoryCategory" defaultValue="musician"><option value="musician">Musician</option><option value="creator/staff">Creator / Staff</option></Select>
      </Field>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label={t("主SNS URL")} htmlFor="admin-primary-sns-url">
          <Input id="admin-primary-sns-url" name="primarySnsUrl" type="url" />
        </Field>
        <Field label="Web URL" htmlFor="admin-website-url">
          <Input id="admin-website-url" name="websiteUrl" type="url" />
        </Field>
      </div>

      <Field label={t("追加リンク")} htmlFor="admin-links">
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
        <Field label={t("アイコンURL")} htmlFor="admin-icon-image-url">
          <Input id="admin-icon-image-url" name="iconImageUrl" type="url" />
        </Field>
        <Field label={t("別名")} htmlFor="admin-aliases">
          <Input id="admin-aliases" name="aliases" placeholder="comma separated" />
        </Field>
        <Field label={t("VRChat名")} htmlFor="admin-vrc-name">
          <Input id="admin-vrc-name" name="vrcName" />
        </Field>
        <Field label={t("Discord名")} htmlFor="admin-discord-name">
          <Input id="admin-discord-name" name="discordName" />
        </Field>
      </div>

      <div className="flex flex-wrap items-end gap-4">
        <Field label={t("公開状態")} htmlFor="admin-visibility">
          <Select id="admin-visibility" name="visibility" defaultValue="draft">
            <option value="draft">draft</option>
            <option value="public">public</option>
            <option value="hidden">hidden</option>
          </Select>
        </Field>
      </div>

      {result ? (
        result.ok ? (
          <p className="text-sm text-muted">
            {t("作成しました:")}{" "}
            <a
              href={result.musician.url}
              className="text-ink underline-offset-2 hover:underline"
            >
              {result.musician.slug}
            </a>
          </p>
        ) : (
          <p className="text-sm text-red-600">{t(result.error)}</p>
        )
      ) : null}

      <div>
        <Button type="submit" variant="solid" disabled={disabled || submitting || !roles.length}>
          <Plus className="size-4" />
          {submitting ? t("作成中...") : t("メンバーを追加")}
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
