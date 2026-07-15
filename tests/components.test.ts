import { describe, expect, it } from "vitest";
import {
  buildBasicProfileModal,
  buildLinkModal,
  buildOptionalFieldsModal,
  buildPreviewMessageData,
  CustomIds,
  mergedPreviewState,
  parseCustomId,
} from "@/lib/discord/components";
import { ComponentType } from "@/lib/discord/types";
import { makeMusician } from "./helpers/fake-store";

const musician = makeMusician();
const sessionId = "123e4567-e89b-42d3-a456-426614174000";

type ModalData = {
  custom_id: string;
  title: string;
  components: Array<{
    type: number;
    label: string;
    component: { type: number; custom_id: string };
  }>;
};

describe("Modal構造がDiscord公式制約を満たす", () => {
  const modals = [
    buildBasicProfileModal(CustomIds.basicModalNew, musician),
    buildBasicProfileModal(CustomIds.basicModalRevise(sessionId), musician),
    buildOptionalFieldsModal(sessionId, musician),
    buildLinkModal(sessionId),
  ];

  it.each(modals.map((modal) => [modal.data as unknown as ModalData]))(
    "title45文字以内・custom_id1〜100文字・入力1〜5個・Text InputはLabel内",
    (data) => {
      expect(data.title.length).toBeLessThanOrEqual(45);
      expect(data.custom_id.length).toBeGreaterThanOrEqual(1);
      expect(data.custom_id.length).toBeLessThanOrEqual(100);
      expect(data.components.length).toBeGreaterThanOrEqual(1);
      expect(data.components.length).toBeLessThanOrEqual(5);
      for (const item of data.components) {
        expect(item.type).toBe(ComponentType.Label);
        expect(item.component.type).toBe(ComponentType.TextInput);
        expect(item.component.custom_id.length).toBeGreaterThanOrEqual(1);
        expect(item.component.custom_id.length).toBeLessThanOrEqual(100);
      }
    },
  );

  it("基本Modalは5項目、任意Modalは4項目、リンクModalは5項目", () => {
    expect((modals[0].data as unknown as ModalData).components).toHaveLength(5);
    expect((modals[2].data as unknown as ModalData).components).toHaveLength(4);
    expect((modals[3].data as unknown as ModalData).components).toHaveLength(5);
  });
});

describe("preview message", () => {
  it("ephemeralで反映・修正・キャンセルbuttonを含む", () => {
    const session = {
      sessionId,
      discordInteractionId: "i-1",
      discordUserId: "user-1",
      musicianId: musician.id,
      baseVersion: 1,
      validatedPayload: { fields: { display_name: "新名" }, link_ops: [] },
      expiresAt: new Date(Date.now() + 60_000).toISOString(),
      consumedAt: null,
    };
    const data = buildPreviewMessageData(session, musician);
    expect(data.flags).toBe(64);
    const row = (data.components as Array<{ components: Array<{ custom_id: string; label: string }> }>)[0];
    const customIds = row.components.map((button) => button.custom_id);
    expect(customIds).toContain(CustomIds.confirmButton(sessionId));
    expect(customIds).toContain(CustomIds.reviseButton(sessionId));
    expect(customIds).toContain(CustomIds.cancelButton(sessionId));
    expect(row.components.map((button) => button.label)).toEqual(
      expect.arrayContaining(["反映する", "修正する", "キャンセル"]),
    );
    for (const id of customIds) expect(id.length).toBeLessThanOrEqual(100);
    expect(String(data.content)).toContain("新名");
  });
});

describe("parseCustomId", () => {
  it("各custom_idを往復できる", () => {
    expect(parseCustomId(CustomIds.basicModalNew)).toEqual({
      kind: "basic-modal-new",
    });
    expect(parseCustomId(CustomIds.basicModalRevise(sessionId))).toEqual({
      kind: "basic-modal-revise",
      sessionId,
    });
    expect(parseCustomId(CustomIds.confirmButton(sessionId))).toEqual({
      kind: "preview-button",
      action: "confirm",
      sessionId,
    });
    expect(parseCustomId("unexpected")).toEqual({ kind: "unknown" });
  });
});

describe("mergedPreviewState", () => {
  it("sessionの値を現在のプロフィールへ重ねる", () => {
    const base = makeMusician({
      links: [
        { platform: "x", label: null, url: "https://x.com/old", displayOrder: 10 },
      ],
    });
    const merged = mergedPreviewState(base, {
      fields: { display_name: "上書き", primary_sns_url: "" },
      link_ops: [
        { op: "delete", url: "https://x.com/old" },
        { op: "upsert", url: "https://b.example/", display_order: 5 },
      ],
    });
    expect(merged.displayName).toBe("上書き");
    expect(merged.primarySnsUrl).toBeNull();
    expect(merged.links).toHaveLength(1);
    expect(merged.links[0].url).toBe("https://b.example/");
  });
});
