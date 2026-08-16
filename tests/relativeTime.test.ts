import { describe, expect, it } from "vitest";

import { zh } from "../src/client/locales.ts";
import { formatRelativeTime } from "../src/client/relativeTime.ts";

const t = (key: keyof typeof zh): string => zh[key];
const now = Date.parse("2026-08-15T12:00:00+08:00");

describe("formatRelativeTime", () => {
  it("uses short relative phrases", () => {
    expect(formatRelativeTime(now - 10_000, now, t)).toBe("刚刚");
    expect(formatRelativeTime(now - 5 * 60_000, now, t)).toBe("5 分钟前");
    expect(formatRelativeTime(now - 3 * 3_600_000, now, t)).toBe("3 小时前");
    expect(formatRelativeTime(now - 26 * 3_600_000, now, t)).toBe("昨天");
    expect(formatRelativeTime(now - 3 * 86_400_000, now, t)).toBe("3 天前");
  });

  it("falls back to a calendar date", () => {
    expect(formatRelativeTime(Date.parse("2026-03-02T12:00:00+08:00"), now, t)).toBe("3月2日");
    expect(formatRelativeTime(Date.parse("2025-12-01T12:00:00+08:00"), now, t)).toBe("2025年12月1日");
  });
});
