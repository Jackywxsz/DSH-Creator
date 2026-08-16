import type { ReactNode } from "react";

import "./Surface.css";

export function Surface({
  title,
  hint,
  children,
}: {
  title?: string | undefined;
  hint?: string | undefined;
  children?: ReactNode;
}) {
  return (
    <section className="oilSurface">
      {title !== undefined && <div className="oilSurfaceTitle">{title}</div>}
      {hint !== undefined && <p className="oilSurfaceHint">{hint}</p>}
      {children}
    </section>
  );
}
