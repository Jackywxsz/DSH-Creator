import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { SlotCore } from "@deepseek-ai/dsh-client-ui-slots";
import { describe, expect, it } from "vitest";

import {
  registerCreatorLauncher,
  type CompatibleSidebarSlots,
} from "../src/client/sidebarIntegration.ts";

const root = fileURLToPath(new URL("..", import.meta.url));

describe("host sidebar coexistence", () => {
  it("contributes one Jacky Creator action without declaring host sidebar children", () => {
    const slots = new SlotCore();
    const component = () => null;
    slots.register({
      name: "root",
      children: {
        sidebar: { kind: "single", scope: "root" },
      },
    } as never, component as never);
    slots.register({
      name: "sidebar",
      children: {
        "sidebar.workspaces": { kind: "single", scope: "root" },
        "sidebar.settings": { kind: "single", scope: "root" },
        "sidebar.footer.action": { kind: "list", scope: "root" },
      },
    } as never, component as never);

    registerCreatorLauncher(
      slots as unknown as CompatibleSidebarSlots,
      component,
      "dsh.jacky.creator",
    );

    expect(slots.entries("sidebar.footer.action").map((entry) => entry.options)).toEqual([
      expect.objectContaining({ id: "jacky-creator-launcher", order: 90 }),
    ]);
    expect(slots.entries("sidebar")).toHaveLength(1);
  });

  it("does not couple the launcher to the host footer's hashed class", () => {
    const css = readFileSync(
      `${root}/src/client/sidebar/CreatorLauncher.css`,
      "utf8",
    );

    expect(css).not.toContain('_footerActions');
    expect(css).toContain(".jackyCreatorLauncher");
  });

  it("keeps the workspace click-through around its interactive panes", () => {
    const workspaceCss = readFileSync(
      `${root}/src/client/sidebar/CreatorWorkspace.css`,
      "utf8",
    );
    const workspace = readFileSync(
      `${root}/src/client/sidebar/CreatorWorkspace.tsx`,
      "utf8",
    );

    expect(workspaceCss).toContain("pointer-events: none !important");
    expect(workspaceCss).toMatch(/\.jackyWorkspaceSidebar[\s\S]*pointer-events: auto/);
    expect(workspace).not.toContain('name: "sidebar"');
    expect(workspace).toContain("resize?.observe(sidebar)");
    expect(workspace).toContain("resize?.observe(conversation)");
    expect(workspace).toContain('frame.addEventListener("transitionend", onTransitionEnd)');
    expect(workspace).toContain('frame.removeEventListener("transitionend", onTransitionEnd)');
    expect(workspace).toContain('if (window.matchMedia("(max-width: 1179px)").matches) setSidebarTab("sessions")');
    expect(workspace).toContain("closeDetails={closeContentDetails}");
    expect(workspaceCss).not.toContain("width: auto !important");
    expect(workspace).toContain("<ContentSidebarPanel");
    expect(workspace).toContain("<OperationsSidebarPanel");
    expect(workspace).toContain("<OperationsWorkspace");
  });
});
