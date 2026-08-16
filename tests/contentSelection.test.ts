import { afterEach, describe, expect, it } from "vitest";

import {
  bumpLibrary,
  getLibraryEpoch,
  getSelectedContentId,
  getSidebarTab,
  inspectorIsOpen,
  setSelectedContentId,
  setSidebarTab,
  subscribeLibrary,
  subscribeSelectedContentId,
  subscribeSidebarChrome,
} from "../src/client/contentSelection.ts";

describe("content selection", () => {
  afterEach(() => {
    setSidebarTab("sessions");
    setSelectedContentId(null);
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
});
