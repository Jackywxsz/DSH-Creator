import { OIL_ICON_SRC } from "./assets/oilIcon.ts";
import "./oilHero.css";

export const OIL_HERO_LINE = "Oil — all your ideas, shipped.";

const STOCK = new Set(["探索未至之境", "Into the Unknown"]);
const STOCK_BADGE = new Set(["预览版", "Preview"]);

function applyHeroRow(row: HTMLElement): void {
  if (row.dataset.oilHero === "1") return;
  row.dataset.oilHero = "1";
  const markHost = row.querySelector("svg")?.parentElement ?? row.firstElementChild;
  const svg = markHost?.querySelector("svg");
  if (svg !== null && svg !== undefined) {
    const img = document.createElement("img");
    img.className = "oilHeroMark";
    img.src = OIL_ICON_SRC;
    img.alt = "";
    img.width = 34;
    img.height = 34;
    img.setAttribute("aria-hidden", "true");
    svg.replaceWith(img);
  }
  for (const span of row.querySelectorAll(":scope > span")) {
    const text = (span.textContent ?? "").trim();
    if (STOCK.has(text) || text === OIL_HERO_LINE) {
      span.textContent = OIL_HERO_LINE;
      continue;
    }
    if (STOCK_BADGE.has(text)) {
      span.setAttribute("hidden", "");
    }
  }
}

export function restyleOilHero(root: ParentNode = document): number {
  let count = 0;
  for (const el of root.querySelectorAll("span")) {
    const text = (el.textContent ?? "").trim();
    if (!STOCK.has(text)) continue;
    const row = el.parentElement;
    if (row === null || row.dataset.oilHero === "1") continue;
    applyHeroRow(row);
    count += 1;
  }
  return count;
}

export function installOilHero(): () => void {
  restyleOilHero();
  let frame = 0;
  const observer = new MutationObserver((mutations) => {
    if (frame !== 0) return;
    let added: ParentNode | undefined;
    for (const mutation of mutations) {
      for (const node of mutation.addedNodes) {
        if (!(node instanceof HTMLElement)) continue;
        if (node.matches("span") || node.querySelector("span") !== null) {
          added = node;
          break;
        }
      }
      if (added !== undefined) break;
    }
    if (added === undefined) return;
    const root = added;
    frame = window.requestAnimationFrame(() => {
      frame = 0;
      restyleOilHero(root);
    });
  });
  observer.observe(document.documentElement, { childList: true, subtree: true });
  return () => {
    observer.disconnect();
    if (frame !== 0) window.cancelAnimationFrame(frame);
  };
}
