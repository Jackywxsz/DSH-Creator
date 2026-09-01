import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

/* Strip full-line `#` comments so assertions inspect directives, not prose. */
function directives(patch: string): string {
  return patch
    .split("\n")
    .filter((line) => !/^\s*#/.test(line))
    .join("\n");
}

/* ----------------------------------------------------------------------------
 * Sidebar coexistence invariant.
 *
 * The plugin contributes an operations launcher into the host-owned
 * `sidebar.footer.action` slot instead of replacing the sidebar. That only
 * works if a host sidebar owner exists in every DSH runtime mode. DSH Desktop
 * (advanced / extended) re-enables the host `ui-sidebar` on its own, but
 * compatibility mode and source-boot do NOT — so if the bundle patch disables
 * `ui-sidebar`, those modes end up with no sidebar owner, `sidebar.footer.action`
 * is never declared, and the operations entry cannot render.
 *
 * The fix is to stop disabling any host UI slot. This test locks that in: the
 * bundle patch may contribute the plugin, but must never disable a host slot.
 * ------------------------------------------------------------------------- */

const root = fileURLToPath(new URL("..", import.meta.url));

async function readPatch(): Promise<string> {
  return readFile(`${root}/cordis.patch.yml`, "utf8");
}

describe("sidebar coexistence (single host sidebar owner)", () => {
  it("keeps the jacky-creator bundle insert so the plugin still loads", async () => {
    const patch = await readPatch();
    // Same shape the release check enforces: an insert of the plugin bundle.
    expect(patch).toContain("- id: jacky-creator\n      name: jacky-creator");
  });

  it("never disables the host ui-sidebar (would strip the footer slot owner)", async () => {
    const patch = directives(await readPatch());
    // The word may still appear in a comment explaining the decision; only a
    // real `- id: ui-sidebar` directive would remove the host owner.
    expect(patch).not.toMatch(/^\s*-?\s*id:\s*ui-sidebar\b/m);
  });

  it("never disables any host slot in any mode", async () => {
    const patch = directives(await readPatch());
    // A `disabled: true` directive removes a host slot. Coexistence requires
    // leaving all host UI owners in place across compatibility / advanced /
    // extended / source-boot.
    expect(patch).not.toMatch(/disabled:\s*true/);
  });
});
