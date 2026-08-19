import type { ButtonHTMLAttributes, ReactNode } from "react";
import { Pill, StateDot, type StateDotState } from "@deepseek-ai/dsh-client-ui-primitives";

import "./StatusPill.css";

export type StatusTone = "neutral" | "pending" | "active" | "success" | "error";

const TONE_STATE: Record<StatusTone, StateDotState | undefined> = {
  neutral: undefined,
  pending: "warning",
  active: "ongoing",
  success: "done",
  error: "error",
};

export function statusPillClass(tone: StatusTone, extra?: string): string {
  return ["statusPill", tone, extra].filter((part) => part !== undefined && part !== "").join(" ");
}

export function StatusPill({
  tone = "neutral",
  title,
  children,
  onClick,
  ...rest
}: {
  tone?: StatusTone;
  title?: string;
  children: ReactNode;
} & Omit<ButtonHTMLAttributes<HTMLButtonElement>, "children">) {
  const state = TONE_STATE[tone];
  return (
    <Pill
      className={statusPillClass(tone)}
      {...(title === undefined ? {} : { title })}
      {...(onClick === undefined ? {} : { onClick })}
      {...rest}
    >
      {state !== undefined ? <StateDot state={state} size={10} /> : null}
      {children}
    </Pill>
  );
}
