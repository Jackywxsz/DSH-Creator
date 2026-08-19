/**
 * 共享发布平台契约。
 *
 * 保持本模块不依赖 Node 和 UI，让 Host、schema 与客户端复用同一份定义。
 */
export const PUBLISH_PLATFORM_DEFINITIONS = {
  xiaohongshu: {
    name: "小红书",
    icon: "xhs",
    settingsLabel: "settings.platform.xiaohongshu",
    inspectorLabel: "inspector.platform.xhs",
    collectUrl: "https://creator.xiaohongshu.com/new/note-manager",
  },
  douyin: {
    name: "抖音",
    icon: "douyin",
    settingsLabel: "settings.platform.douyin",
    inspectorLabel: "inspector.platform.douyin",
    collectUrl: "https://creator.douyin.com/creator-micro/content/manage",
  },
  bilibili: {
    name: "B站",
    icon: "bilibili",
    settingsLabel: "settings.platform.bilibili",
    inspectorLabel: "inspector.platform.bilibili",
    collectUrl: "https://member.bilibili.com/platform/upload-manager/article",
  },
  wechat: {
    name: "视频号",
    icon: "wechat",
    settingsLabel: "settings.platform.wechat",
    inspectorLabel: "inspector.platform.wechat",
    collectUrl: "https://channels.weixin.qq.com/platform/post/list",
  },
} as const;

export type PublishPlatform = keyof typeof PUBLISH_PLATFORM_DEFINITIONS;

export const PUBLISH_PLATFORMS = Object.freeze(
  Object.keys(PUBLISH_PLATFORM_DEFINITIONS) as [PublishPlatform, ...PublishPlatform[]],
);

export function isPublishPlatform(value: unknown): value is PublishPlatform {
  return typeof value === "string" && value in PUBLISH_PLATFORM_DEFINITIONS;
}

export function normalizeEnabledPlatforms(value: unknown): PublishPlatform[] {
  if (!Array.isArray(value)) return [...PUBLISH_PLATFORMS];
  const enabled = new Set(value.filter(isPublishPlatform));
  return PUBLISH_PLATFORMS.filter((platform) => enabled.has(platform));
}
