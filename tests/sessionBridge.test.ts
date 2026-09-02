import { describe, expect, it } from "vitest";

import { appendContentReference } from "../src/client/operations/sessionBridge.tsx";

describe("current content composer reference", () => {
  it("appends without replacing or submitting the existing draft", () => {
    expect(appendContentReference("")).toBe("/current content");
    expect(appendContentReference("先保留这段草稿")).toBe("先保留这段草稿\n/current content");
    expect(appendContentReference("已有换行\n")).toBe("已有换行\n/current content");
  });

  it("does not duplicate an existing current-content reference", () => {
    expect(appendContentReference("看看 /current content")).toBe("看看 /current content");
  });
});
