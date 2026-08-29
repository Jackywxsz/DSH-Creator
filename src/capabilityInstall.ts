import { spawn } from "node:child_process";
import { cp, mkdir, mkdtemp, rename, rm, stat } from "node:fs/promises";
import { homedir, tmpdir } from "node:os";
import { basename, join } from "node:path";

import type { CreatorInstallTarget, PublishPlatform } from "./types.ts";

interface Recipe {
  repo: string;
  commit: string;
  source?: string;
  directory: string;
}

const RECIPES: Record<CreatorInstallTarget, Recipe> = {
  subtitle: {
    repo: "https://github.com/oil-oil/oil-subtitle",
    commit: "5de9be62c10fe752a2a3663f7c7f736956f1636c",
    directory: "oil-subtitle",
  },
  coverBase: {
    repo: "https://github.com/oil-oil/oil-cover",
    commit: "3a882c051532b7225879079117c0efbed5e1b5dd",
    directory: "oil-cover",
  },
  editing: {
    repo: "https://github.com/oil-oil/screen-studio-editor",
    commit: "1b747a0e1f5a4005d37207be3891800dd1b37a42",
    directory: "screen-studio-editor",
  },
  publisher: {
    repo: "https://github.com/Jackywxsz/Jacky-video-publisher",
    commit: "9d2805373af7b969f1e49309215bd6eadc35aa14",
    source: "video-publisher",
    directory: "video-publisher",
  },
};

export function dshSkillRoot(home = homedir()): string {
  return join(home, ".agents", "skills");
}

async function pathIsDirectory(path: string): Promise<boolean> {
  return stat(path).then((info) => info.isDirectory(), () => false);
}

export async function runCommand(
  command: string,
  args: readonly string[],
  cwd?: string,
  signal?: AbortSignal,
): Promise<void> {
  const appendOutput = (current: string, chunk: Buffer | string): string => (
    (current + String(chunk)).slice(-32_000)
  );
  await new Promise<void>((resolve, reject) => {
    if (signal?.aborted === true) {
      reject(signal.reason ?? new Error("aborted"));
      return;
    }
    const child = spawn(command, [...args], {
      ...(cwd === undefined ? {} : { cwd }),
      stdio: ["ignore", "pipe", "pipe"],
    });
    let stdout = "";
    let stderr = "";
    child.stdout?.on("data", (chunk: Buffer | string) => {
      stdout = appendOutput(stdout, chunk);
    });
    child.stderr?.on("data", (chunk: Buffer | string) => {
      stderr = appendOutput(stderr, chunk);
    });
    const onAbort = () => { child.kill("SIGTERM"); };
    signal?.addEventListener("abort", onAbort, { once: true });
    child.once("error", (cause) => {
      signal?.removeEventListener("abort", onAbort);
      reject(cause);
    });
    child.once("exit", (code) => {
      signal?.removeEventListener("abort", onAbort);
      if (signal?.aborted === true) reject(signal.reason ?? new Error("aborted"));
      else if (code === 0) resolve();
      else {
        const detail = [stderr.trim(), stdout.trim()].filter(Boolean).join("\n");
        reject(new Error(`${basename(command)} exited ${code}: ${detail.slice(-1_000)}`));
      }
    });
  });
}

export async function installCreatorCapability(
  target: CreatorInstallTarget,
  options: { home?: string; run?: typeof runCommand; signal?: AbortSignal } = {},
): Promise<{ changed: boolean; detail: string; path: string }> {
  const home = options.home ?? homedir();
  const run = options.run ?? runCommand;
  const recipe = RECIPES[target];
  const root = dshSkillRoot(home);
  const destination = join(root, recipe.directory);

  if (await pathIsDirectory(destination)) {
    if (target === "subtitle") {
      const ready = process.platform === "win32"
        ? await pathIsDirectory(join(destination, ".venv", "Scripts"))
        : await pathIsDirectory(join(destination, ".venv", "bin"));
      if (!ready) {
        if (process.platform === "win32") {
          throw new Error("字幕初始化目前需要在 macOS/Linux 执行 setup.sh。目录已保留，请按提示手动初始化。");
        }
        await run("bash", [join(destination, "setup.sh")], destination, options.signal);
        return { changed: true, detail: "字幕 Skill 已完成初始化。", path: destination };
      }
    }
    return { changed: false, detail: "目标目录已经存在，未覆盖现有 Skill。", path: destination };
  }

  await mkdir(root, { recursive: true });
  const staging = await mkdtemp(join(tmpdir(), "jacky-creator-skill-"));
  const installStaging = await mkdtemp(join(root, ".jacky-creator-install-"));
  try {
    const checkout = join(staging, "repo");
    await run("git", ["clone", "--filter=blob:none", "--no-checkout", recipe.repo, checkout], undefined, options.signal);
    await run("git", ["-C", checkout, "checkout", "--detach", recipe.commit], undefined, options.signal);
    const source = recipe.source === undefined ? checkout : join(checkout, recipe.source);
    if (!await stat(join(source, "SKILL.md")).then((info) => info.isFile(), () => false)) {
      throw new Error("固定版本中缺少 SKILL.md，未安装任何内容。");
    }
    options.signal?.throwIfAborted();
    const prepared = join(installStaging, recipe.directory);
    await cp(source, prepared, {
      recursive: true,
      errorOnExist: true,
      filter: (path) => basename(path) !== ".git",
    });
    options.signal?.throwIfAborted();
    await rename(prepared, destination);
  } finally {
    await rm(staging, { recursive: true, force: true });
    await rm(installStaging, { recursive: true, force: true });
  }
  if (target === "subtitle") {
    if (process.platform === "win32") {
      return { changed: true, detail: "字幕 Skill 已安装；Windows 初始化请按设置提示完成。", path: destination };
    }
    await run("bash", [join(destination, "setup.sh")], destination, options.signal);
  }
  return { changed: true, detail: "Skill 已安装到 DSH 可发现目录。", path: destination };
}

const PUBLISHER_PLATFORM: Record<PublishPlatform, string> = {
  xiaohongshu: "xiaohongshu",
  douyin: "douyin",
  bilibili: "bilibili",
  wechat: "wechat_channels",
};

export async function configurePublisher(
  skillRoot: string,
  libraryRoot: string,
  platforms: readonly PublishPlatform[],
  run: typeof runCommand = runCommand,
  signal?: AbortSignal,
): Promise<void> {
  if (platforms.length === 0) throw new Error("请先选择至少一个确实拥有账号的平台并保存。");
  const args = [join(skillRoot, "scripts", "config.mjs"), "onboard", "--source-dir", libraryRoot];
  for (const platform of platforms) {
    args.push("--available-platform", PUBLISHER_PLATFORM[platform]);
    args.push("--platform", PUBLISHER_PLATFORM[platform]);
  }
  args.push("--originality-policy", "ask_each_run");
  await run(process.execPath, args, skillRoot, signal);
}
