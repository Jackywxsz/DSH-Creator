import { useEffect, useState, type ReactNode } from "react";

import type { ContentCovers, CoverThumbResult } from "../types.ts";

export function coverThumbRevision(covers: ContentCovers): string {
  return `${covers["3x4"] ?? ""}|${covers["4x3"] ?? ""}|${covers["16x9"] ?? ""}`;
}

export function CoverThumb({
  id,
  load,
  fallback = null,
  revision = 0,
}: {
  id: string;
  load: (id: string) => Promise<CoverThumbResult>;
  fallback?: ReactNode;
  revision?: number | string;
}) {
  const [src, setSrc] = useState<string | undefined>(undefined);
  useEffect(() => {
    setSrc(undefined);
  }, [id]);
  useEffect(() => {
    let cancelled = false;
    void load(id).then((thumb) => {
      if (cancelled || !thumb.found) return;
      setSrc(`data:${thumb.mime};base64,${thumb.base64}`);
    });
    return () => {
      cancelled = true;
    };
  }, [id, load, revision]);
  if (src === undefined) return fallback;
  return <img src={src} alt="" />;
}
