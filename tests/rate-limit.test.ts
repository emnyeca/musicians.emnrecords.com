import { beforeEach, describe, expect, it } from "vitest";
import { isRateLimited, resetRateLimiter } from "@/lib/discord/rate-limit";

describe("isRateLimited", () => {
  beforeEach(() => resetRateLimiter());

  it("windows内の上限超過で制限する", () => {
    const now = 1_700_000_000_000;
    for (let index = 0; index < 20; index += 1) {
      expect(isRateLimited("user-1", now + index)).toBe(false);
    }
    expect(isRateLimited("user-1", now + 30)).toBe(true);
  });

  it("windowが過ぎればまた許可する", () => {
    const now = 1_700_000_000_000;
    for (let index = 0; index < 21; index += 1) {
      isRateLimited("user-1", now + index);
    }
    expect(isRateLimited("user-1", now + 61_000)).toBe(false);
  });

  it("ユーザーごとに独立して数える", () => {
    const now = 1_700_000_000_000;
    for (let index = 0; index < 21; index += 1) {
      isRateLimited("user-1", now + index);
    }
    expect(isRateLimited("user-2", now + 30)).toBe(false);
  });
});
