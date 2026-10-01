"use client";
import { useTranslation } from "@/lib/i18n";
import { ROLE_GROUPS, ROLE_OPTIONS, canonicalRole } from "@/lib/roles";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Select } from "./ui/select";

export function roleSelection(roles: string[]) {
  const normalized = roles.map(canonicalRole);
  return { roles: [...new Set(normalized.map((r) => ROLE_OPTIONS.includes(r) ? r : "Other"))], otherRole: normalized.filter((r) => !ROLE_OPTIONS.includes(r)).join(", ") };
}
export function roleValues(roles: string[], otherRole: string): string[] {
  return roles.map((r) => r === "Other" && otherRole.trim() ? otherRole.trim() : r);
}
export function RolePicker({ roles, otherRole, onChange }: {
  roles: string[]; otherRole: string; onChange: (roles: string[], other: string) => void;
}) {
  const t = useTranslation();
  return <div className="space-y-3">
    <p className="text-sm font-medium">{t("担当（必須・30件まで）")}</p>
    <p className="text-xs text-muted">{t("一番上がプライマリーロールです。クレジット作成時の主な担当として使われます。「メインにする」で変更できます。")}</p>
    {roles.map((role, index) => <div key={role} className="flex flex-wrap items-center gap-2 rounded-md border border-line p-2 text-sm">
      <span className="flex-1">{role}{index === 0 && <span className="ml-2 text-xs text-muted">{t("メイン")}</span>}</span>
      {index > 0 && <Button type="button" size="sm" onClick={() => onChange([role, ...roles.filter((r) => r !== role)], otherRole)}>{t("メインにする")}</Button>}
      <Button type="button" size="sm" aria-label={`${t("削除")}: ${role}`} onClick={() => onChange(roles.filter((r) => r !== role), otherRole)}>{t("削除")}</Button>
    </div>)}
    <Select aria-label={t("担当を追加")} value="" disabled={roles.length >= 30} onChange={(e) => { if (e.target.value) onChange([...roles, e.target.value], otherRole); }}>
      <option value="">{t("担当を選んで追加…")}</option>
      {Object.entries(ROLE_GROUPS).map(([group, options]) => <optgroup key={group} label={t(group)}>{options.filter((r) => !roles.includes(r)).map((r) => <option key={r} value={r}>{r === "Double Bass" ? t("Double Bass（ウッドベース）") : r}</option>)}</optgroup>)}
    </Select>
    {roles.includes("Other") && <label className="block text-sm">{t("Otherの具体的な担当（任意・40文字まで）")}<Input maxLength={40} value={otherRole} onChange={(e) => onChange(roles, e.target.value)} />
      <span className="text-xs text-muted">{t("記入内容はプロフィールとクレジットに使います。検索タグは「Other」になります。")}</span>
    </label>}
  </div>;
}
