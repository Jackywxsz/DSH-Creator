import { describe, expect, it } from "vitest";

import { creatorGuideText } from "../src/guide.ts";
import type { CreatorCapability, CreatorSetupStatus } from "../src/types.ts";

function capability(state: CreatorCapability["state"], detail = ""): CreatorCapability {
  return { state, required: false, detail };
}

function statusOf(overrides: {
  publishSync?: CreatorCapability;
  scriptRules?: string;
  enabledPlatforms?: Array<"xiaohongshu" | "douyin" | "bilibili" | "wechat">;
}): CreatorSetupStatus {
  return {
    platform: "darwin",
    dataDir: "/data",
    settings: {
      libraryRoot: "/Movies/视频项目",
      profile: {
        enabledPlatforms: overrides.enabledPlatforms ?? ["xiaohongshu", "douyin", "bilibili", "wechat"],
      },
      secrets: {
        subtitle: { kind: "subtitle", ref: "subtitle", configured: true, writable: true },
        cover: { kind: "cover", ref: "cover", configured: true, writable: true },
      },
      ...(overrides.scriptRules === undefined ? {} : { scriptRules: overrides.scriptRules }),
    },
    capabilities: {
      library: capability("ready"),
      screenStudio: capability("ready"),
      subtitleSkill: capability("ready"),
      subtitleCredential: capability("ready"),
      coverSkill: capability("ready"),
      coverCredential: capability("ready"),
      publishSync: overrides.publishSync ?? capability("ready"),
      editingSkill: capability("ready"),
      publishSkill: capability("ready"),
      presentationSkill: capability("ready"),
      articleSkill: capability("ready"),
    },
    recommendations: [],
  };
}

describe("creatorGuideText", () => {
  it("covers the full workflow with live paths", () => {
    const guide = creatorGuideText(statusOf({}));
    expect(guide).toContain("/Movies/视频项目");
    expect(guide).toContain("YYYY-MM-DD_可读标题");
    expect(guide).toContain("script.md");
    expect(guide).toContain("oil_organize_library");
    expect(guide).toContain("oil_generate_subtitles");
    expect(guide).toContain("oil_generate_cover");
    expect(guide).toContain("oil_sync_publish");
    expect(guide).toContain("video-publisher");
  });

  it("tells the model auto-publish and data sync need Ego Browser when missing", () => {
    const guide = creatorGuideText(statusOf({
      publishSync: capability("missing", "未发现 Ego Browser；自动发布和发布数据回收不可用。"),
    }));
    expect(guide).toContain("未发现 Ego Browser");
    expect(guide).toContain("自动发布");
    expect(guide).toContain("oil_sync_publish");
    expect(guide).toContain("lite.ego.app");
    expect(guide).toContain("不要假装能同步");
  });

  it("confirms publish and sync when Ego Browser is ready", () => {
    const guide = creatorGuideText(statusOf({}));
    expect(guide).toContain("当前已发现 Ego Browser");
    expect(guide).toContain("首次运行就申请宿主写权限");
    expect(guide).toContain("~/.config/video-publisher");
    expect(guide).toContain("~/.video-publisher");
    expect(guide).toContain("其余已登录平台继续准备草稿");
    expect(guide).not.toContain("不要假装能同步");
  });

  it("lists enabled platforms and limits publishing and sync to them", () => {
    const guide = creatorGuideText(statusOf({ enabledPlatforms: ["douyin", "bilibili"] }));
    expect(guide).toContain("当前 enabledPlatforms：抖音（douyin）、B站（bilibili）");
    expect(guide).toContain("jacky-video-publisher（兼容 video-publisher） 与 oil_sync_publish 只处理这些平台");
    expect(guide).not.toContain("小红书（xiaohongshu）");
  });

  it("stops automatic publishing and sync when no platform is enabled", () => {
    const guide = creatorGuideText(statusOf({ enabledPlatforms: [] }));
    expect(guide).toContain("当前 enabledPlatforms 为空（[]）");
    expect(guide).toContain("不要调用 jacky-video-publisher（兼容 video-publisher），也不要调用 oil_sync_publish");
    expect(guide).toContain("先用 oil_creator_setup 配置启用平台");
    expect(guide).toContain("不执行自动发布和数据回收");
  });

  it("asks for a persona before writing scripts when rules are unset", () => {
    const guide = creatorGuideText(statusOf({}));
    expect(guide).toContain("当前没有配置脚本规则（人设）");
    expect(guide).toContain("oil_script_rules");
  });

  it("tells the model to follow existing rules when configured", () => {
    const guide = creatorGuideText(statusOf({ scriptRules: "口语化。" }));
    expect(guide).toContain("已配置脚本规则（人设）");
    expect(guide).not.toContain("当前没有配置脚本规则");
  });

  it("keeps content production available without Screen Studio", () => {
    const status = statusOf({});
    status.capabilities.screenStudio = capability("missing", "未发现 Screen Studio；绑定工程、自动剪辑（screen-studio-editor）不可用。");
    const guide = creatorGuideText(status);
    expect(guide).toContain("自动剪辑");
    expect(guide).toContain("screen-studio-editor");
    expect(guide).toContain("当前没有可用的 Screen Studio");
    expect(guide).toContain("剪映或其他工具");
    expect(guide).toContain("工作台会继续推进");
  });

  it("covers article transcription without requiring Screen Studio", () => {
    const guide = creatorGuideText(statusOf({}));
    expect(guide).toContain("## 公众号图文");
    expect(guide).toContain("不依赖额外的图文转换 skill");
    expect(guide).toContain("script.md 为主要输入");
    expect(guide).toContain("标准 Markdown 文件");
    expect(guide).toContain("Obsidian MDFlow");
  });

  it("gives install commands and key sites for missing skills and credentials", () => {
    const status = statusOf({});
    status.capabilities.subtitleSkill = capability("missing");
    status.capabilities.coverSkill = capability("missing");
    status.capabilities.subtitleCredential = capability("missing");
    status.capabilities.coverCredential = capability("missing");
    const guide = creatorGuideText(status);
    expect(guide).toContain("git clone https://github.com/oil-oil/oil-subtitle ~/.agents/skills/oil-subtitle");
    expect(guide).toContain("bash ~/.agents/skills/oil-subtitle/setup.sh");
    expect(guide).toContain("git clone https://github.com/oil-oil/oil-cover ~/.agents/skills/oil-cover");
    expect(guide).toContain("bailian.console.aliyun.com");
    expect(guide).toContain("zenmux.ai");
    expect(guide).toContain("不要让用户把 Key 明文发到对话里");
  });

  it("runs setup in the detected subtitle directory instead of cloning another copy", () => {
    const status = statusOf({});
    status.capabilities.subtitleSkill = {
      state: "missing",
      required: false,
      detail: "已发现 oil-subtitle 目录，但尚未完成 setup.sh。",
      path: "/custom/oil-subtitle",
    };
    const guide = creatorGuideText(status);
    expect(guide).toContain('bash "/custom/oil-subtitle/setup.sh"');
    expect(guide).not.toContain("git clone https://github.com/oil-oil/oil-subtitle");
  });

  it("gives the video-publisher install command without requiring an article skill", () => {
    const status = statusOf({});
    status.capabilities.publishSkill = capability("missing");
    const guide = creatorGuideText(status);
    expect(guide).toContain("设置 → 插件 → Jacky Creator");
    expect(guide).toContain("公开兼容包仍使用 video-publisher 身份");
    expect(guide).toContain("当前会话里改写");
    expect(guide).not.toContain("git clone https://github.com/oil-oil/oil-video-article");
  });

  it("lists environment recommendations when present", () => {
    const status = statusOf({});
    status.recommendations = ["先选择一个可读写的内容目录。"];
    const guide = creatorGuideText(status);
    expect(guide).toContain("## 环境建议");
    expect(guide).toContain("先选择一个可读写的内容目录。");
  });
});
