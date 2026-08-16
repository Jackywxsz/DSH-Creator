/** Shell controls copied from the official sidebar namespace. */
export const SIDEBAR_NS = "sidebar";

export const sidebarZh = {
  "session.new": "新会话",
  "session.new.label": "新建会话",
  "toggle.open": "打开侧边栏",
  "toggle.collapse": "收起侧边栏",
} as const;

export const sidebarEn = {
  "session.new": "New Session",
  "session.new.label": "New session",
  "toggle.open": "Open sidebar",
  "toggle.collapse": "Collapse sidebar",
} as const;

export type SidebarShellKey = keyof typeof sidebarZh;
