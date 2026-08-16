import type { CreatorKey } from "./locales.ts";

export function formatRelativeTime(
  recordedAt: number,
  now: number,
  t: (key: CreatorKey) => string,
): string {
  const delta = now - recordedAt;
  if (delta < 45_000) return t("time.justNow");
  if (delta < 60 * 60 * 1000) {
    return t("time.minutes").replace("{n}", String(Math.max(1, Math.round(delta / 60_000))));
  }
  if (delta < 24 * 60 * 60 * 1000) {
    return t("time.hours").replace("{n}", String(Math.max(1, Math.round(delta / 3_600_000))));
  }
  const days = Math.round(delta / 86_400_000);
  if (days === 1) return t("time.yesterday");
  if (days < 7) return t("time.days").replace("{n}", String(days));

  const date = new Date(recordedAt);
  const current = new Date(now);
  if (date.getFullYear() === current.getFullYear()) {
    return t("time.monthDay")
      .replace("{m}", String(date.getMonth() + 1))
      .replace("{d}", String(date.getDate()));
  }
  return t("time.yearMonthDay")
    .replace("{y}", String(date.getFullYear()))
    .replace("{m}", String(date.getMonth() + 1))
    .replace("{d}", String(date.getDate()));
}
