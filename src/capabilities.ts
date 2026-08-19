import { constants, existsSync } from "node:fs";
import { access, stat } from "node:fs/promises";
import { homedir } from "node:os";
import { delimiter, join } from "node:path";

import { skillDirCandidates } from "./config.ts";
import { resolveCoverSkill } from "./generate.ts";
import { resolveSubtitleSkill, subtitleInstallCommand } from "./subtitle.ts";
import type {
  CreatorCapabilities,
  CreatorCapability,
  CreatorSecrets,
  CreatorSetupStatus,
  LibrarySettings,
} from "./types.ts";

interface InspectCreatorSetupOptions {
  libraryRoot: string;
  dataDir: string;
  subtitleSkillDir: string;
  coverSkillDir: string;
  settings: LibrarySettings;
  platform?: NodeJS.Platform;
  env?: NodeJS.ProcessEnv;
  findSkillDir?: (skillName: string) => string | undefined;
}

export function defaultFindSkillDir(skillName: string): string | undefined {
  return skillDirCandidates(skillName).find((candidate) => existsSync(candidate));
}

function capability(
  state: CreatorCapability["state"],
  required: boolean,
  detail: string,
  path?: string,
): CreatorCapability {
  return path === undefined
    ? { state, required, detail }
    : { state, required, detail, path };
}

async function libraryCapability(path: string): Promise<CreatorCapability> {
  const info = await stat(path).catch(() => undefined);
  if (info === undefined || !info.isDirectory()) {
    return capability("missing", true, "内容目录不存在，需要先选择或创建目录。", path);
  }
  const writable = await access(path, constants.R_OK | constants.W_OK).then(() => true, () => false);
  return writable
    ? capability("ready", true, "内容目录可读写。", path)
    : capability("missing", true, "内容目录存在，但当前进程没有读写权限。", path);
}

async function screenStudioCapability(platform: NodeJS.Platform): Promise<CreatorCapability> {
  if (platform !== "darwin") {
    return capability("unsupported", false, "Screen Studio 仅支持 macOS；录制绑定和自动剪辑不可用，其他内容管理能力仍可使用。");
  }
  const candidates = [
    "/Applications/Screen Studio.app",
    join(homedir(), "Applications", "Screen Studio.app"),
  ];
  for (const path of candidates) {
    if (await access(path).then(() => true, () => false)) {
      return capability("ready", false, "已发现 Screen Studio，可绑定工程和自动剪辑。", path);
    }
  }
  return capability("missing", false, "未发现 Screen Studio；绑定工程、自动剪辑（screen-studio-editor）不可用。");
}

async function subtitleCapability(path: string): Promise<CreatorCapability> {
  const info = await stat(path).catch(() => undefined);
  if (info === undefined || !info.isDirectory()) {
    return capability(
      "missing",
      false,
      `未发现 oil-subtitle；执行 ${subtitleInstallCommand(path)} 后重试。`,
      path,
    );
  }
  try {
    const resolved = await resolveSubtitleSkill(path);
    return capability("ready", false, "已发现字幕工作流。", resolved.root);
  } catch {
    return capability(
      "missing",
      false,
      `已发现 oil-subtitle 目录，但尚未完成 setup.sh；执行 bash "${join(path, "setup.sh")}" 后重试。字幕生成和预览暂不可用。`,
      path,
    );
  }
}

async function coverCapability(path: string): Promise<CreatorCapability> {
  try {
    const resolved = await resolveCoverSkill(path);
    return capability("ready", false, "已发现封面工作流。", resolved.root);
  } catch {
    return capability("missing", false, "未发现 oil-cover；封面生成不可用。", path);
  }
}

function credentialCapability(secret: CreatorSecrets[keyof CreatorSecrets], label: string): CreatorCapability {
  return secret.configured
    ? capability("ready", false, `${label}凭据已配置。`)
    : capability("missing", false, `${label}凭据未配置。`);
}

function skillCapability(
  findSkillDir: (skillName: string) => string | undefined,
  skillName: string,
): CreatorCapability {
  const found = findSkillDir(skillName);
  return found === undefined
    ? capability("missing", false, `未发现 ${skillName}。`)
    : capability("ready", false, `已发现 ${skillName}。`, found);
}

export async function findExecutable(
  command: string,
  env: NodeJS.ProcessEnv = process.env,
  platform: NodeJS.Platform = process.platform,
): Promise<string | undefined> {
  const pathValue = env.PATH ?? "";
  const extensions = platform === "win32"
    ? (env.PATHEXT ?? ".EXE;.CMD;.BAT;.COM").split(";")
    : [""];
  for (const directory of pathValue.split(delimiter).filter(Boolean)) {
    for (const extension of extensions) {
      const path = join(directory, platform === "win32" ? `${command}${extension}` : command);
      if (await access(path, constants.X_OK).then(() => true, () => false)) return path;
    }
  }
  return undefined;
}

function recommendationsOf(capabilities: CreatorCapabilities): string[] {
  const recommendations: string[] = [];
  if (capabilities.library.state !== "ready") recommendations.push("先选择一个可读写的内容目录。");
  if (capabilities.screenStudio.state === "missing") recommendations.push("需要录屏和自动剪辑时再安装 Screen Studio（screen.studio，仅 macOS）。");
  if (capabilities.subtitleSkill.state !== "ready") {
    const installedPath = capabilities.subtitleSkill.path;
    recommendations.push(
      capabilities.subtitleSkill.detail.includes("尚未完成 setup.sh") && installedPath !== undefined
        ? `字幕：bash "${join(installedPath, "setup.sh")}"`
        : installedPath === undefined
          ? "字幕：git clone https://github.com/oil-oil/oil-subtitle ~/.agents/skills/oil-subtitle && bash ~/.agents/skills/oil-subtitle/setup.sh"
          : `字幕：${subtitleInstallCommand(installedPath)}`,
    );
  }
  if (capabilities.subtitleCredential.state !== "ready") recommendations.push("字幕 Key：到百炼控制台（https://bailian.console.aliyun.com）申请 DASHSCOPE_API_KEY，在设置页填写。");
  if (capabilities.coverSkill.state !== "ready") recommendations.push("封面：git clone https://github.com/oil-oil/oil-cover ~/.agents/skills/oil-cover");
  if (capabilities.coverCredential.state !== "ready") recommendations.push("封面 Key：到 ZenMux（https://zenmux.ai）控制台申请 ZENMUX_API_KEY，在设置页填写。");
  if (capabilities.publishSync.state !== "ready") recommendations.push("自动发布和数据回收：安装 Ego Browser（https://lite.ego.app，仅 macOS）并登录各平台后台。");
  if (capabilities.editingSkill.state !== "ready") recommendations.push("自动剪辑：git clone https://github.com/oil-oil/screen-studio-editor ~/.agents/skills/screen-studio-editor");
  if (capabilities.publishSkill.state !== "ready") recommendations.push("自动发布：git clone https://github.com/oil-oil/video-publisher-skill ~/.agents/skills/video-publisher");
  if (capabilities.articleSkill.state !== "ready") recommendations.push("公众号图文：git clone https://github.com/oil-oil/oil-video-article ~/.agents/skills/oil-video-article");
  return recommendations;
}

export async function inspectCreatorSetup(
  options: InspectCreatorSetupOptions,
): Promise<CreatorSetupStatus> {
  const platform = options.platform ?? process.platform;
  const findSkillDir = options.findSkillDir ?? defaultFindSkillDir;
  const egoPath = await findExecutable("ego-browser", options.env ?? process.env, platform);
  const capabilities: CreatorCapabilities = {
    library: await libraryCapability(options.libraryRoot),
    screenStudio: await screenStudioCapability(platform),
    subtitleSkill: await subtitleCapability(options.subtitleSkillDir),
    subtitleCredential: credentialCapability(options.settings.secrets.subtitle, "字幕"),
    coverSkill: await coverCapability(options.coverSkillDir),
    coverCredential: credentialCapability(options.settings.secrets.cover, "封面"),
    publishSync: egoPath === undefined
      ? capability("missing", false, "未发现 Ego Browser；自动发布和发布数据回收不可用。")
      : capability("ready", false, "已发现 Ego Browser，可自动发布和回收发布数据。", egoPath),
    editingSkill: skillCapability(findSkillDir, "screen-studio-editor"),
    publishSkill: skillCapability(findSkillDir, "video-publisher"),
    articleSkill: skillCapability(findSkillDir, "oil-video-article"),
  };
  return {
    platform,
    dataDir: options.dataDir,
    settings: options.settings,
    capabilities,
    recommendations: recommendationsOf(capabilities),
  };
}
