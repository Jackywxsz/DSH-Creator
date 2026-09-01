/* ----------------------------------------------------------------------------
 * FullscreenSurface
 *
 * Full-frame stage for the cockpit views on DSH builds that ship their own
 * sidebar shell (whose client plugin loads regardless of host-side loader
 * patches, so the plugin cannot replace the sidebar without colliding on
 * `sidebar.workspaces`). The workspace CSS offsets itself by
 * `--oil-sidebar-width` (the plugin's old private sidebar, 280px). With `nav`,
 * the surface recreates that geometry: the operations nav panel occupies the
 * left column and the variable is set to its width so children align beside
 * it; without `nav`, the offset is zeroed and children fill edge to edge.
 * Renders as a deliberate mode: open via the footer launcher, leave via the
 * close button or Escape.
 *
 * Escape belongs to the innermost open layer. The cockpit's own forms use the
 * host Modal (a `role="dialog"` / `aria-modal` layer that closes itself on
 * Escape), so this surface must yield whenever such a layer is open — otherwise
 * one Escape both dismisses the dialog and tears down the whole surface,
 * discarding the unsaved form behind it. Rather than enumerate every dialog,
 * the surface asks the DOM whether a modal layer is currently mounted and only
 * closes when none is.
 * ------------------------------------------------------------------------- */

import { useEffect, type ReactNode } from "react";
import { escapeClosesSurface, modalLayerOpen } from "./escapeIntent.ts";
import "./FullscreenSurface.css";

export interface FullscreenSurfaceProps {
  onClose?: () => void;
  nav?: ReactNode;
  children: ReactNode;
}

export function FullscreenSurface({ onClose, nav, children }: FullscreenSurfaceProps) {
  useEffect(() => {
    if (onClose === undefined) return;
    const onKey = (event: KeyboardEvent): void => {
      if (escapeClosesSurface(event, modalLayerOpen())) onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => { window.removeEventListener("keydown", onKey); };
  }, [onClose]);
  return (
    <div className={nav !== undefined ? "jackyFullscreenSurface jackyHasNav" : "jackyFullscreenSurface"}>
      {nav !== undefined && (
        // The nav panel's own stylesheet is scoped to the plugin sidebar
        // surface; carry the same data attributes so those rules apply here.
        <div className="jackyFullscreenNav" data-plugin="jacky-creator" data-surface="sidebar">
          {nav}
        </div>
      )}
      {children}
      {onClose !== undefined && (
        <button
          type="button"
          className="jackyFullscreenClose"
          aria-label="Close"
          title="Close (Esc)"
          onClick={onClose}
        >
          ✕
        </button>
      )}
    </div>
  );
}
