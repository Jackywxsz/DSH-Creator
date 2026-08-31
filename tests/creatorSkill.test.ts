import { describe, expect, it, vi } from "vitest";

import { CREATOR_WORKBENCH_SKILL, registerCreatorWorkbenchSkill } from "../src/creatorSkill.ts";

describe("jacky-creator-workbench skill", () => {
  it("registers a model-visible onboarding workflow", () => {
    const dispose = vi.fn();
    const register = vi.fn(() => dispose);
    expect(registerCreatorWorkbenchSkill({ skills: { register } })).toBe(dispose);
    expect(register).toHaveBeenCalledWith(CREATOR_WORKBENCH_SKILL);
    expect(CREATOR_WORKBENCH_SKILL.name).toBe("jacky-creator-workbench");
    expect(CREATOR_WORKBENCH_SKILL.content).toContain("jacky_creator_guide");
    expect(CREATOR_WORKBENCH_SKILL.content).toContain("jacky_creator_setup");
    expect(CREATOR_WORKBENCH_SKILL.content).toContain("jacky_creator_script_rules");
    expect(CREATOR_WORKBENCH_SKILL.content).toContain("内容目录和 `enabledPlatforms`");
    expect(CREATOR_WORKBENCH_SKILL.content).toContain("这里不配置创作者名称或平台主页");
    expect(CREATOR_WORKBENCH_SKILL.content).toContain("脚本规则（人设）");
    expect(CREATOR_WORKBENCH_SKILL.content).toContain("只处理 `enabledPlatforms` 中的平台");
    expect(CREATOR_WORKBENCH_SKILL.content).toContain("`enabledPlatforms` 为空时不执行发布或同步");
    expect(CREATOR_WORKBENCH_SKILL.content).not.toContain("内容目录、创作者名称和平台主页");
    expect(CREATOR_WORKBENCH_SKILL.content).toContain("Ego Browser");
    expect(CREATOR_WORKBENCH_SKILL.content).toContain("apply=false");
    expect(CREATOR_WORKBENCH_SKILL.content).toContain("候选内容目录不存在时");
    expect(CREATOR_WORKBENCH_SKILL.content).toContain("用户确认后");
    expect(CREATOR_WORKBENCH_SKILL.content).toContain("最终发表必须由用户明确确认");
  });
});
