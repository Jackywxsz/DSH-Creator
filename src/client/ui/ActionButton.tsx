import type { ButtonHTMLAttributes, ReactNode } from "react";
import { Button } from "@deepseek-ai/dsh-client-ui-primitives";

import "./ActionButton.css";

export type ActionTone = "primary" | "secondary" | "ghost";

const VARIANT: Record<ActionTone, "primary" | "outline" | "ghost"> = {
  primary: "primary",
  secondary: "outline",
  ghost: "ghost",
};

export function ActionButton({
  tone = "secondary",
  children,
  ...rest
}: {
  tone?: ActionTone;
  children: ReactNode;
} & Omit<ButtonHTMLAttributes<HTMLButtonElement>, "type">) {
  return (
    <Button type="button" size="sm" variant={VARIANT[tone]} {...rest}>
      {children}
    </Button>
  );
}

export function ActionBar({ children }: { children: ReactNode }) {
  return <div className="oilActionBar">{children}</div>;
}
