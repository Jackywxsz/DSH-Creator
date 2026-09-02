import { useEffect, useState } from "react";

import {
  browserCreatorStorage,
  loadCreatorUiState,
  saveCreatorUiState,
  type SidebarTab,
} from "./persistence.ts";
import { INSPECTOR_DEFAULT, INSPECTOR_MAX, INSPECTOR_MIN } from "./inspectorGeometry.ts";

type Listener = () => void;

export type OperationsSection = "ideas" | "today" | "schedule" | "content" | "goals" | "reviews" | "settings";

const listeners = new Set<Listener>();
const libraryListeners = new Set<Listener>();
const profileListeners = new Set<Listener>();
const initialUi = loadCreatorUiState(browserCreatorStorage());
let selectedId = initialUi.selectedId;
let sidebarTab: SidebarTab = initialUi.sidebarTab;
let inspectorVisible = false;
let operationsSection: OperationsSection = "today";
let libraryEpoch = 0;
let profileEpoch = 0;
let ideaCaptureEpoch = 0;
const ideaCaptureListeners = new Set<Listener>();
let sidebarWidthPx = 280;
let inspectorWidthPx = clampInspectorWidth(initialUi.inspectorWidth ?? INSPECTOR_DEFAULT);

function clampInspectorWidth(px: number): number {
  return Math.min(INSPECTOR_MAX, Math.max(INSPECTOR_MIN, Math.round(px)));
}

const chromeListeners = new Set<Listener>();

interface InlineStyleSnapshot {
  paddingLeft: string;
  paddingLeftPriority: string;
  transition: string;
  transitionPriority: string;
}

let sidebarWidthStyleCaptured = false;
let previousSidebarWidthStyle = "";
let previousSidebarWidthPriority = "";
let insetHost: HTMLElement | null = null;
let insetStyleSnapshot: InlineStyleSnapshot | null = null;

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
  if (sidebarWidthPx === px && (typeof document === "undefined" || sidebarWidthStyleCaptured)) return;
  sidebarWidthPx = px;
  if (typeof document !== "undefined") {
    if (!sidebarWidthStyleCaptured) {
      previousSidebarWidthStyle = document.documentElement.style.getPropertyValue("--oil-sidebar-width");
      previousSidebarWidthPriority = document.documentElement.style.getPropertyPriority("--oil-sidebar-width");
      sidebarWidthStyleCaptured = true;
    }
    document.documentElement.style.setProperty("--oil-sidebar-width", `${px}px`);
  }
  emitChrome();
}

export function releaseShellChrome(): void {
  if (typeof document !== "undefined") {
    if (sidebarWidthStyleCaptured) {
      if (previousSidebarWidthStyle === "") {
        document.documentElement.style.removeProperty("--oil-sidebar-width");
      } else {
        document.documentElement.style.setProperty(
          "--oil-sidebar-width",
          previousSidebarWidthStyle,
          previousSidebarWidthPriority,
        );
      }
    }
  }
  sidebarWidthStyleCaptured = false;
  previousSidebarWidthStyle = "";
  previousSidebarWidthPriority = "";
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
  emitChrome();
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

export function bumpProfile(): void {
  profileEpoch += 1;
  for (const listener of profileListeners) listener();
}

export function getProfileEpoch(): number {
  return profileEpoch;
}

export function subscribeProfile(listener: Listener): () => void {
  profileListeners.add(listener);
  return () => {
    profileListeners.delete(listener);
  };
}

export function useProfileEpoch(): number {
  const [epoch, setEpoch] = useState(getProfileEpoch);
  useEffect(() => subscribeProfile(() => {
    setEpoch(getProfileEpoch());
  }), []);
  return epoch;
}

/**
 * The rc.7 public layout face exposes panel actions and shell slots, but no
 * content-column inset. The host's stable scrollport is therefore the only
 * remaining compatibility seam for keeping the overlay from covering the
 * conversation. This adapter intentionally has one host, no observer, and a
 * complete inline-style restore path.
 */
function conversationHost(): HTMLElement | null {
  if (typeof document === "undefined" || typeof HTMLElement === "undefined") return null;
  const scrollport = document.querySelector("[data-conversation-scroll]");
  const host = scrollport?.parentElement;
  return host instanceof HTMLElement ? host : null;
}

function restoreInsetHost(): void {
  if (insetHost === null || insetStyleSnapshot === null) return;
  if (insetStyleSnapshot.paddingLeft === "") {
    insetHost.style.removeProperty("padding-left");
  } else {
    insetHost.style.setProperty(
      "padding-left",
      insetStyleSnapshot.paddingLeft,
      insetStyleSnapshot.paddingLeftPriority,
    );
  }
  if (insetStyleSnapshot.transition === "") {
    insetHost.style.removeProperty("transition");
  } else {
    insetHost.style.setProperty(
      "transition",
      insetStyleSnapshot.transition,
      insetStyleSnapshot.transitionPriority,
    );
  }
  insetHost = null;
  insetStyleSnapshot = null;
}

function captureInsetHost(host: HTMLElement): void {
  if (insetHost === host && insetStyleSnapshot !== null) return;
  restoreInsetHost();
  insetHost = host;
  insetStyleSnapshot = {
    paddingLeft: host.style.getPropertyValue("padding-left"),
    paddingLeftPriority: host.style.getPropertyPriority("padding-left"),
    transition: host.style.getPropertyValue("transition"),
    transitionPriority: host.style.getPropertyPriority("transition"),
  };
}

export function clearConversationInset(): void {
  restoreInsetHost();
}

export function applyConversationInset(width: number, animate = true): HTMLElement | null {
  const host = conversationHost();
  if (host === null) return null;
  captureInsetHost(host);
  if (width <= 0) {
    restoreInsetHost();
    return host;
  }
  host.style.setProperty(
    "transition",
    animate ? "padding-left var(--ds-transition-duration-slow) var(--ds-ease-in-out)" : "none",
  );
  host.style.setProperty("padding-left", `${width}px`);
  return host;
}

export function getSidebarTab(): SidebarTab {
  return sidebarTab;
}

export function setSidebarTab(tab: SidebarTab): void {
  if (sidebarTab === tab) return;
  sidebarTab = tab;
  if (tab !== "content" && inspectorVisible) {
    inspectorVisible = false;
    clearConversationInset();
  }
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

export function getOperationsSection(): OperationsSection {
  return operationsSection;
}

export function setOperationsSection(section: OperationsSection): void {
  if (operationsSection === section) return;
  operationsSection = section;
  emitChrome();
}

export function useOperationsSection(): OperationsSection {
  const [section, setSection] = useState(getOperationsSection);
  useEffect(() => subscribeSidebarChrome(() => {
    setSection(getOperationsSection());
  }), []);
  return section;
}

export function requestIdeaCapture(): void {
  ideaCaptureEpoch += 1;
  for (const listener of ideaCaptureListeners) listener();
}

export function useIdeaCaptureEpoch(): number {
  const [epoch, setEpoch] = useState(ideaCaptureEpoch);
  useEffect(() => {
    const listener = (): void => { setEpoch(ideaCaptureEpoch); };
    ideaCaptureListeners.add(listener);
    return () => { ideaCaptureListeners.delete(listener); };
  }, []);
  return epoch;
}

export function inspectorIsOpen(): boolean {
  return selectedId !== null && inspectorVisible;
}

export function contentInspectorIsVisible(): boolean {
  return inspectorVisible;
}

export function setContentInspectorVisible(visible: boolean): void {
  const next = visible && selectedId !== null;
  if (inspectorVisible === next) return;
  inspectorVisible = next;
  if (!next) clearConversationInset();
  emitChrome();
}

export function useContentInspectorVisible(): boolean {
  const [visible, setVisible] = useState(contentInspectorIsVisible);
  useEffect(() => subscribeSidebarChrome(() => {
    setVisible(contentInspectorIsVisible());
  }), []);
  return visible;
}

export function openContentDetails(id: string): void {
  setSelectedContentId(id);
  setContentInspectorVisible(true);
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
  if (id === null) {
    inspectorVisible = false;
    clearConversationInset();
    emitChrome();
  }
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
