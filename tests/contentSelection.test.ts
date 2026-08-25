import { afterEach, describe, expect, it, vi } from "vitest";

import {
  bumpLibrary,
  bumpProfile,
  getLibraryEpoch,
  getOperationsSection,
  getProfileEpoch,
  getSelectedContentId,
  getSidebarTab,
  inspectorIsOpen,
  setSelectedContentId,
  setOperationsSection,
  setSidebarTab,
  subscribeLibrary,
  subscribeProfile,
  subscribeSelectedContentId,
  subscribeSidebarChrome,
} from "../src/client/contentSelection.ts";

describe("content selection", () => {
  afterEach(() => {
    setSidebarTab("sessions");
    setOperationsSection("today");
    setSelectedContentId(null);
    vi.unstubAllGlobals();
  });

  it("notifies subscribers and persists", () => {
    const seen: Array<string | null> = [];
    const stop = subscribeSelectedContentId(() => {
      seen.push(getSelectedContentId());
    });
    setSelectedContentId("2026-01-23_demo");
    setSelectedContentId("2026-01-23_demo");
    expect(seen).toEqual(["2026-01-23_demo"]);
    expect(getSelectedContentId()).toBe("2026-01-23_demo");
    stop();
  });

  it("keeps the inspector when switching to sessions", () => {
    setSidebarTab("content");
    setSelectedContentId("2026-01-23_demo");
    expect(inspectorIsOpen()).toBe(true);
    const seen: Array<string | null> = [];
    const stop = subscribeSelectedContentId(() => {
      seen.push(getSelectedContentId());
    });
    let chrome = 0;
    const stopChrome = subscribeSidebarChrome(() => {
      chrome += 1;
    });
    setSidebarTab("sessions");
    expect(getSidebarTab()).toBe("sessions");
    expect(chrome).toBe(1);
    stopChrome();
    expect(getSelectedContentId()).toBe("2026-01-23_demo");
    expect(inspectorIsOpen()).toBe(true);
    expect(seen).toEqual([]);
    stop();
  });

  it("tracks the active operations section through chrome subscribers", () => {
    let chrome = 0;
    const stop = subscribeSidebarChrome(() => {
      chrome += 1;
    });
    setOperationsSection("goals");
    setOperationsSection("goals");
    expect(getOperationsSection()).toBe("goals");
    expect(chrome).toBe(1);
    stop();
  });

  it("bumps the library epoch", () => {
    const start = getLibraryEpoch();
    let seen = start;
    const stop = subscribeLibrary(() => {
      seen = getLibraryEpoch();
    });
    bumpLibrary();
    expect(seen).toBe(start + 1);
    stop();
  });

  it("keeps profile refreshes separate from library refreshes", () => {
    const profileStart = getProfileEpoch();
    let profileSeen = profileStart;
    const stop = subscribeProfile(() => {
      profileSeen = getProfileEpoch();
    });

    bumpLibrary();
    expect(profileSeen).toBe(profileStart);
    bumpProfile();
    expect(profileSeen).toBe(profileStart + 1);
    stop();
  });

  it("restores the inset host and global chrome on plugin release", async () => {
    class FakeStyle {
      private readonly values = new Map<string, { value: string; priority: string }>();

      getPropertyValue(name: string): string {
        return this.values.get(name)?.value ?? "";
      }

      getPropertyPriority(name: string): string {
        return this.values.get(name)?.priority ?? "";
      }

      setProperty(name: string, value: string, priority = ""): void {
        this.values.set(name, { value, priority });
      }

      removeProperty(name: string): void {
        this.values.delete(name);
      }
    }

    class FakeHTMLElement {
      readonly style = new FakeStyle();
      parentElement: FakeHTMLElement | null = null;
    }

    const root = new FakeHTMLElement();
    const host = new FakeHTMLElement();
    const scrollport = new FakeHTMLElement();
    scrollport.parentElement = host;
    host.style.setProperty("padding-left", "8px", "important");
    host.style.setProperty("transition", "opacity 1s");
    root.style.setProperty("--oil-sidebar-width", "11px", "important");
    vi.stubGlobal("HTMLElement", FakeHTMLElement);
    vi.stubGlobal("document", {
      documentElement: root,
      querySelector: () => scrollport,
    });

    const { applyConversationInset, clearConversationInset, releaseShellChrome, setSidebarChromeWidth } =
      await import("../src/client/contentSelection.ts");

    expect(applyConversationInset(640, false)).toBe(host);
    expect(host.style.getPropertyValue("padding-left")).toBe("640px");
    expect(host.style.getPropertyValue("transition")).toBe("none");
    expect(applyConversationInset(720, true)).toBe(host);
    expect(host.style.getPropertyValue("padding-left")).toBe("720px");

    setSidebarChromeWidth(350);
    expect(root.style.getPropertyValue("--oil-sidebar-width")).toBe("350px");
    releaseShellChrome();
    clearConversationInset();
    expect(host.style.getPropertyValue("padding-left")).toBe("8px");
    expect(host.style.getPropertyPriority("padding-left")).toBe("important");
    expect(host.style.getPropertyValue("transition")).toBe("opacity 1s");
    expect(root.style.getPropertyValue("--oil-sidebar-width")).toBe("11px");
    expect(root.style.getPropertyPriority("--oil-sidebar-width")).toBe("important");

    setSidebarChromeWidth(350);
    expect(root.style.getPropertyValue("--oil-sidebar-width")).toBe("350px");
    releaseShellChrome();
    expect(root.style.getPropertyValue("--oil-sidebar-width")).toBe("11px");
  });

  it("does not touch the document when the conversation seam is absent", async () => {
    class FakeHTMLElement {
      readonly style = {};
      parentElement: FakeHTMLElement | null = null;
    }

    vi.stubGlobal("HTMLElement", FakeHTMLElement);
    vi.stubGlobal("document", {
      documentElement: new FakeHTMLElement(),
      querySelector: () => null,
    });
    const { applyConversationInset } = await import("../src/client/contentSelection.ts");
    expect(applyConversationInset(640)).toBeNull();
  });
});
