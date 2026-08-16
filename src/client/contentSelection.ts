import { useEffect, useState } from "react";

import {
  browserCreatorStorage,
  loadCreatorUiState,
  saveCreatorUiState,
  type SidebarTab,
} from "./persistence.ts";

type Listener = () => void;

const listeners = new Set<Listener>();
const libraryListeners = new Set<Listener>();
const initialUi = loadCreatorUiState(browserCreatorStorage());
let selectedId = initialUi.selectedId;
let sidebarTab: SidebarTab = initialUi.sidebarTab;
let libraryEpoch = 0;
let sidebarWidthPx = 280;
export const INSPECTOR_MIN = 320;
export const INSPECTOR_MAX = 800;
export const INSPECTOR_DEFAULT = 640;
let inspectorWidthPx = clampInspectorWidth(initialUi.inspectorWidth ?? INSPECTOR_DEFAULT);

function clampInspectorWidth(px: number): number {
  return Math.min(INSPECTOR_MAX, Math.max(INSPECTOR_MIN, Math.round(px)));
}

const chromeListeners = new Set<Listener>();

function emitChrome(): void {
  for (const listener of chromeListeners) listener();
}

export function subscribeSidebarChrome(listener: Listener): () => void {
  chromeListeners.add(listener);
  return () => {
    chromeListeners.delete(listener);
  };
}

export function setSidebarChromeWidth(px: number): void {
  if (sidebarWidthPx === px) return;
  sidebarWidthPx = px;
  if (typeof document !== "undefined") {
    document.documentElement.style.setProperty("--oil-sidebar-width", `${px}px`);
  }
  emitChrome();
}

export function releaseShellChrome(): void {
  if (typeof document !== "undefined") {
    document.documentElement.style.removeProperty("--oil-sidebar-width");
  }
  clearConversationInset();
}

export function getSidebarChromeWidth(): number {
  return sidebarWidthPx;
}

export function setInspectorWidth(px: number): void {
  const next = clampInspectorWidth(px);
  if (inspectorWidthPx === next) return;
  inspectorWidthPx = next;
  const state = loadCreatorUiState(browserCreatorStorage());
  saveCreatorUiState(browserCreatorStorage(), { ...state, inspectorWidth: next });
}

export function getInspectorWidth(): number {
  return inspectorWidthPx;
}

function emit(): void {
  for (const listener of listeners) listener();
}

function emitLibrary(): void {
  for (const listener of libraryListeners) listener();
}

export function bumpLibrary(): void {
  libraryEpoch += 1;
  emitLibrary();
}

export function getLibraryEpoch(): number {
  return libraryEpoch;
}

export function subscribeLibrary(listener: Listener): () => void {
  libraryListeners.add(listener);
  return () => {
    libraryListeners.delete(listener);
  };
}

export function useLibraryEpoch(): number {
  const [epoch, setEpoch] = useState(getLibraryEpoch);
  useEffect(() => subscribeLibrary(() => {
    setEpoch(getLibraryEpoch());
  }), []);
  return epoch;
}

function conversationHost(): HTMLElement | null {
  if (typeof document === "undefined") return null;
  const host = document.querySelector("[data-conversation-scroll]")?.parentElement;
  return host instanceof HTMLElement ? host : null;
}

const INSET_MARK = "data-oil-conversation-inset";

function resetHostPadding(host: HTMLElement, animate: boolean): void {
  host.style.transition = animate
    ? "padding-left var(--ds-transition-duration-slow) var(--ds-ease-in-out)"
    : "none";
  host.style.paddingLeft = "0px";
  host.removeAttribute(INSET_MARK);
}

export function clearConversationInset(): void {
  if (typeof document === "undefined") return;
  for (const node of document.querySelectorAll(`[${INSET_MARK}]`)) {
    if (node instanceof HTMLElement) resetHostPadding(node, true);
  }
  const host = conversationHost();
  if (host !== null) resetHostPadding(host, true);
}

export function applyConversationInset(width: number, animate = true): HTMLElement | null {
  const host = conversationHost();
  if (host === null) return null;
  if (width <= 0) {
    resetHostPadding(host, animate);
    return host;
  }
  host.style.transition = animate
    ? "padding-left var(--ds-transition-duration-slow) var(--ds-ease-in-out)"
    : "none";
  host.style.paddingLeft = `${width}px`;
  host.setAttribute(INSET_MARK, "1");
  return host;
}

export function watchConversationHost(onChange: () => void): () => void {
  let lastHost = conversationHost();
  let frame = 0;
  const observer = new MutationObserver(() => {
    const host = conversationHost();
    if (host === lastHost) return;
    lastHost = host;
    if (frame !== 0) return;
    frame = window.requestAnimationFrame(() => {
      frame = 0;
      onChange();
    });
  });
  observer.observe(document.body, { childList: true, subtree: true });
  return () => {
    observer.disconnect();
    if (frame !== 0) window.cancelAnimationFrame(frame);
  };
}

export function getSidebarTab(): SidebarTab {
  return sidebarTab;
}

export function setSidebarTab(tab: SidebarTab): void {
  if (sidebarTab === tab) return;
  sidebarTab = tab;
  const state = loadCreatorUiState(browserCreatorStorage());
  saveCreatorUiState(browserCreatorStorage(), { ...state, sidebarTab });
  emitChrome();
}

export function useSidebarTab(): SidebarTab {
  const [tab, setTab] = useState(getSidebarTab);
  useEffect(() => subscribeSidebarChrome(() => {
    setTab(getSidebarTab());
  }), []);
  return tab;
}

export function inspectorIsOpen(): boolean {
  return selectedId !== null;
}

export function getSelectedContentId(): string | null {
  return selectedId;
}

export function setSelectedContentId(id: string | null): void {
  if (selectedId === id) {
    if (id === null) clearConversationInset();
    return;
  }
  selectedId = id;
  const state = loadCreatorUiState(browserCreatorStorage());
  saveCreatorUiState(browserCreatorStorage(), { ...state, selectedId });
  if (id === null) clearConversationInset();
  emit();
}

export function subscribeSelectedContentId(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function useSelectedContentId(): [string | null, (id: string | null) => void] {
  const [selectedId, setSelectedId] = useState(getSelectedContentId);
  useEffect(() => subscribeSelectedContentId(() => {
    setSelectedId(getSelectedContentId());
  }), []);
  return [selectedId, setSelectedContentId];
}
