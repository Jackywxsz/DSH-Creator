import { describe, expect, it } from "vitest";

import { escapeClosesSurface, modalLayerOpen } from "../src/client/sidebar/escapeIntent.ts";

/* ----------------------------------------------------------------------------
 * Escape ownership inside the fullscreen cockpit surface.
 *
 * A single Escape must close only the innermost open layer. When a host Modal
 * is open it owns Escape (and closes itself); the surface behind it must stay,
 * or the keystroke would also discard the unsaved form.
 * ------------------------------------------------------------------------- */

describe("escapeClosesSurface", () => {
  it("closes the surface on a plain Escape with no modal open", () => {
    expect(escapeClosesSurface({ key: "Escape" }, false)).toBe(true);
  });

  it("defers to an open modal layer", () => {
    expect(escapeClosesSurface({ key: "Escape" }, true)).toBe(false);
  });

  it("ignores an Escape that commits an IME composition", () => {
    expect(escapeClosesSurface({ key: "Escape", isComposing: true }, false)).toBe(false);
  });

  it("ignores non-Escape keys", () => {
    expect(escapeClosesSurface({ key: "Enter" }, false)).toBe(false);
    expect(escapeClosesSurface({ key: "a" }, false)).toBe(false);
  });
});

describe("modalLayerOpen", () => {
  const dialogRoot: ParentNode = {
    querySelector: (selector: string) => (selector.includes("dialog") ? ({} as Element) : null),
  } as unknown as ParentNode;
  const emptyRoot: ParentNode = {
    querySelector: () => null,
  } as unknown as ParentNode;

  it("detects a mounted dialog/aria-modal layer", () => {
    expect(modalLayerOpen(dialogRoot)).toBe(true);
  });

  it("reports no layer when the root is empty", () => {
    expect(modalLayerOpen(emptyRoot)).toBe(false);
  });

  it("reports no layer when there is no document", () => {
    expect(modalLayerOpen(undefined)).toBe(false);
  });
});
