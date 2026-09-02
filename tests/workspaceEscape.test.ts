import { describe, expect, it, vi } from "vitest";

import {
  createWorkspaceEscapeHandler,
  modalLayerOpen,
} from "../src/client/sidebar/workspaceEscape.ts";

function rootWithModal(open: boolean): ParentNode {
  return { querySelector: () => open ? ({} as Element) : null } as unknown as ParentNode;
}

describe("creator workspace Escape ownership", () => {
  it("closes the workspace when no modal owns Escape", () => {
    const close = vi.fn();
    createWorkspaceEscapeHandler(close, () => rootWithModal(false))({ key: "Escape" });
    expect(close).toHaveBeenCalledOnce();
  });

  it("leaves the workspace open while a modal owns Escape", () => {
    const close = vi.fn();
    createWorkspaceEscapeHandler(close, () => rootWithModal(true))({ key: "Escape" });
    expect(close).not.toHaveBeenCalled();
    expect(modalLayerOpen(rootWithModal(true))).toBe(true);
  });

  it("ignores composition, repeats, and other keys", () => {
    const close = vi.fn();
    const handle = createWorkspaceEscapeHandler(close, () => rootWithModal(false));
    handle({ key: "Escape", isComposing: true });
    handle({ key: "Escape", repeat: true });
    handle({ key: "Enter" });
    expect(close).not.toHaveBeenCalled();
  });
});
