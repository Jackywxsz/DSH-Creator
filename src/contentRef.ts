import type { ContentDetail } from "./types.ts";

export function formatContentRef(detail: ContentDetail): string {
  return detail.folderPath;
}
