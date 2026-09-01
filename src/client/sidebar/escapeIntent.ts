/* ----------------------------------------------------------------------------
 * escapeIntent
 *
 * Policy for who owns the Escape key inside the fullscreen cockpit surface.
 * Escape belongs to the innermost open layer: while a host Modal
 * (`role="dialog"` / `aria-modal`) is mounted it closes itself, so the surface
 * behind it must NOT also close — otherwise a single Escape both dismisses the
 * dialog and tears down the surface, discarding the unsaved form.
 *
 * Extracted as a pure predicate so the decision is testable without a DOM.
 * ------------------------------------------------------------------------- */

/* The host UI kit marks its Modal with standard dialog semantics; either
 * attribute is enough to treat a modal layer as open and defer to it. */
export const MODAL_LAYER_SELECTOR = '[role="dialog"],[aria-modal="true"]';

export interface EscapeSignal {
  key: string;
  /* True while an IME composition is committing; such an Escape cancels the
   * composition and must never reach the surface. */
  isComposing?: boolean;
}

/**
 * Whether an Escape keystroke should close the fullscreen surface.
 * Closes only a genuine Escape that is not an IME commit and not owned by an
 * open modal layer.
 */
export function escapeClosesSurface(event: EscapeSignal, modalLayerOpen: boolean): boolean {
  if (event.key !== "Escape") return false;
  if (event.isComposing === true) return false;
  return !modalLayerOpen;
}

/** Does the document currently host an open modal layer? */
export function modalLayerOpen(root: ParentNode | undefined = typeof document !== "undefined" ? document : undefined): boolean {
  return root?.querySelector(MODAL_LAYER_SELECTOR) != null;
}
