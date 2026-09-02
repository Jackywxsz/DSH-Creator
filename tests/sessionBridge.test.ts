import { describe, expect, it, vi } from "vitest";

import {
  appendContentReference,
  submitCockpitInstruction,
} from "../src/client/operations/sessionBridge.tsx";

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

describe("cockpit AI instruction submission", () => {
  it("keeps the generated current-content reference when submitting a preset", () => {
    const setDraft = vi.fn();
    const submit = vi.fn();

    expect(submitCockpitInstruction({
      sessionId: "session-1",
      input: { draft: "/current content", phase: "plain" },
      actions: { setDraft, submit },
    }, "请按运营经验创作。")).toBe(true);

    expect(setDraft).toHaveBeenCalledWith("请按运营经验创作。\n/current content");
    expect(submit).toHaveBeenCalledOnce();
  });

  it("does not overwrite a user-authored draft", () => {
    const setDraft = vi.fn();
    const submit = vi.fn();

    expect(submitCockpitInstruction({
      sessionId: "session-1",
      input: { draft: "我自己写的草稿", phase: "plain" },
      actions: { setDraft, submit },
    }, "AI 预设指令")).toBe(false);

    expect(setDraft).not.toHaveBeenCalled();
    expect(submit).not.toHaveBeenCalled();
  });
});
