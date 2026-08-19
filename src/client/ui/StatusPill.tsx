import type { ReactNode } from "react";

import "./StatusPill.css";

export type StatusTone = "neutral" | "pending" | "active" | "success" | "error";

export function statusPillClass(tone: StatusTone, extra?: string): string {
  return ["statusPill", tone, extra].filter((part) => part !== undefined && part !== "").join(" ");
}

export function StatusPill({
  tone = "neutral",
  title,
  children,
}: {
  tone?: StatusTone;
  title?: string;
  children: ReactNode;
}) {
  return (
    <span className={statusPillClass(tone)} title={title}>
      <span className="statusDot" aria-hidden="true" />
      {children}
    </span>
  );
}
