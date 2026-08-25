const STORE = "__dshOilCreatorCss";

interface CssStore {
  sheets: Map<string, string>;
}

function cssStore(): CssStore {
  const global = globalThis as typeof globalThis & { [STORE]?: CssStore };
  global[STORE] ??= { sheets: new Map() };
  return global[STORE];
}

export function registerPluginCss(tagId: string, css: string): void {
  cssStore().sheets.set(tagId, css);
  mountPluginCss(tagId, css);
}

function mountPluginCss(tagId: string, css: string): void {
  if (typeof document === "undefined") return;
  const existing = document.querySelector(`style[data-plugin-css=${JSON.stringify(tagId)}]`);
  const tag = existing instanceof HTMLStyleElement ? existing : document.createElement("style");
  tag.dataset.plugin = "dsh-oil-creator";
  tag.dataset.pluginCss = tagId;
  tag.textContent = css;
  if (existing === null) document.head.appendChild(tag);
}

export function remountPluginCss(): void {
  for (const [tagId, css] of cssStore().sheets) mountPluginCss(tagId, css);
}

export function releasePluginCss(): void {
  if (typeof document === "undefined") return;
  for (const tag of document.querySelectorAll('style[data-plugin="dsh-oil-creator"]')) {
    tag.remove();
  }
}

export function mountJackyBrandScope(): () => void {
  if (typeof document === "undefined") return () => {};
  const root = document.documentElement;
  const previous = root.getAttribute("data-jacky-creator-brand");
  root.setAttribute("data-jacky-creator-brand", "paper-growth");
  return () => {
    if (root.getAttribute("data-jacky-creator-brand") !== "paper-growth") return;
    if (previous === null) root.removeAttribute("data-jacky-creator-brand");
    else root.setAttribute("data-jacky-creator-brand", previous);
  };
}
