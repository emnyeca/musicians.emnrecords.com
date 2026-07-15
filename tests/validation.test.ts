import { describe, expect, it } from "vitest";
import {
  mergeValidatedPayloads,
  validateBasicProfileInputs,
  validateLinkInputs,
  validateOptionalProfileInputs,
} from "@/lib/discord/validation";

const validBasic = {
  display_name: "名前",
  name_jp: "名前",
  name_en: "Name",
  roles: "Vo, Gt",
  primary_sns_url: "https://x.com/example",
};

describe("validateBasicProfileInputs", () => {
  it("正しい入力を受理して正規化する", () => {
    const result = validateBasicProfileInputs(validBasic);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.payload.fields.roles).toEqual(["Vo", "Gt"]);
    expect(result.payload.fields.primary_sns_url).toBe("https://x.com/example");
  });

  it("未知項目を含むrequest全体を拒否する", () => {
    const result = validateBasicProfileInputs({
      ...validBasic,
      is_verified: "true",
    });
    expect(result).toMatchObject({ ok: false, errorCode: "unknown_field" });
  });

  it("運営項目(visibility等)を本人入力として受け付けない", () => {
    for (const key of ["visibility", "slug", "version", "is_locked"]) {
      const result = validateBasicProfileInputs({ ...validBasic, [key]: "x" });
      expect(result).toMatchObject({ ok: false, errorCode: "unknown_field" });
    }
  });

  it("不正URLを拒否する", () => {
    for (const url of ["javascript:alert(1)", "ftp://example.com", "http://nohost"]) {
      const result = validateBasicProfileInputs({
        ...validBasic,
        primary_sns_url: url,
      });
      expect(result.ok, url).toBe(false);
    }
  });

  it("過大入力を拒否する", () => {
    expect(
      validateBasicProfileInputs({
        ...validBasic,
        display_name: "あ".repeat(81),
      }),
    ).toMatchObject({ ok: false, errorCode: "field_too_long" });
    expect(
      validateBasicProfileInputs({
        ...validBasic,
        roles: Array.from({ length: 11 }, (_, index) => `role${index}`).join(","),
      }),
    ).toMatchObject({ ok: false, errorCode: "field_too_long" });
    expect(
      validateBasicProfileInputs({
        ...validBasic,
        primary_sns_url: `https://example.com/${"a".repeat(300)}`,
      }),
    ).toMatchObject({ ok: false, errorCode: "invalid_url" });
  });

  it("必須項目の欠落を拒否する", () => {
    expect(
      validateBasicProfileInputs({ ...validBasic, display_name: "  " }),
    ).toMatchObject({ ok: false, errorCode: "missing_field" });
    expect(
      validateBasicProfileInputs({ ...validBasic, roles: "" }),
    ).toMatchObject({ ok: false, errorCode: "missing_field" });
  });
});

describe("validateOptionalProfileInputs", () => {
  it("空欄で項目を削除(空文字化)できる", () => {
    const result = validateOptionalProfileInputs({
      website_url: "",
      vrc_name: "",
      aliases: "",
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.payload.fields.website_url).toBe("");
    expect(result.payload.fields.aliases).toEqual([]);
  });

  it("未知項目を拒否する", () => {
    expect(
      validateOptionalProfileInputs({ locked_reason: "x" }),
    ).toMatchObject({ ok: false, errorCode: "unknown_field" });
  });
});

describe("validateLinkInputs", () => {
  it("追加リンクをupsert opへ変換する", () => {
    const result = validateLinkInputs({
      url: "youtube.com/@example",
      platform: "",
      label: "YouTube",
      display_order: "10",
      delete: "",
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.payload.link_ops[0]).toMatchObject({
      op: "upsert",
      platform: "youtube",
      display_order: 10,
    });
  });

  it("削除指定をdelete opへ変換する", () => {
    const result = validateLinkInputs({
      url: "https://example.com/page",
      delete: "削除",
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.payload.link_ops[0]).toMatchObject({ op: "delete" });
  });

  it("不正なplatform・表示順を拒否する", () => {
    expect(
      validateLinkInputs({ url: "https://example.com", platform: "myspace" }),
    ).toMatchObject({ ok: false, errorCode: "invalid_field" });
    expect(
      validateLinkInputs({ url: "https://example.com", display_order: "-1" }),
    ).toMatchObject({ ok: false, errorCode: "invalid_field" });
  });
});

describe("mergeValidatedPayloads", () => {
  it("後の値でfieldsを上書きし、同一URLのlink opを置換する", () => {
    const merged = mergeValidatedPayloads(
      {
        fields: { display_name: "旧", vrc_name: "V" },
        link_ops: [{ op: "upsert", url: "https://a.example/" }],
      },
      {
        fields: { display_name: "新" },
        link_ops: [
          { op: "delete", url: "https://a.example/" },
          { op: "upsert", url: "https://b.example/" },
        ],
      },
    );
    expect(merged.fields).toEqual({ display_name: "新", vrc_name: "V" });
    expect(merged.link_ops).toEqual([
      { op: "delete", url: "https://a.example/" },
      { op: "upsert", url: "https://b.example/" },
    ]);
  });
});
