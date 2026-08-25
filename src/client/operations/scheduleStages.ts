import type { ScheduleItem } from "../../cockpit/schemas.ts";

export const PRODUCTION_STAGES = [
  "topic",
  "script",
  "recording",
  "editing",
  "publishing",
  "review",
] as const satisfies readonly ScheduleItem["milestone"][];

export type ProductionStage = (typeof PRODUCTION_STAGES)[number];

interface StageDragPayload {
  kind: "stage";
  contentId: string;
  milestone: ProductionStage;
}

export function createStageDragPayload(contentId: string, milestone: ProductionStage): string {
  return JSON.stringify({ kind: "stage", contentId, milestone } satisfies StageDragPayload);
}

export function parseStageDragPayload(raw: string): { contentId: string; milestone: ProductionStage } | undefined {
  try {
    const payload = JSON.parse(raw) as Partial<StageDragPayload>;
    if (payload.kind !== "stage" || typeof payload.contentId !== "string" || payload.contentId === "") return undefined;
    if (typeof payload.milestone !== "string" || !PRODUCTION_STAGES.includes(payload.milestone as ProductionStage)) return undefined;
    return { contentId: payload.contentId, milestone: payload.milestone as ProductionStage };
  } catch {
    return undefined;
  }
}
