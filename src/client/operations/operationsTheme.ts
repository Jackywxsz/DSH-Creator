import { useSyncExternalStore } from "react";

export type OperationsTheme = "light" | "dark";

const STORAGE_KEY = "creator-cockpit-theme";
const listeners = new Set<() => void>();

function readStoredTheme(): OperationsTheme {
  if (typeof window === "undefined") return "light";
  try {
    return window.localStorage.getItem(STORAGE_KEY) === "dark" ? "dark" : "light";
  } catch {
    return "light";
  }
}

let currentTheme: OperationsTheme = readStoredTheme();

function applyDocumentTheme(theme: OperationsTheme): void {
  if (typeof document === "undefined") return;
  document.documentElement.dataset.creatorCockpitTheme = theme;
}

applyDocumentTheme(currentTheme);

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}

export function setOperationsTheme(theme: OperationsTheme): void {
  if (theme === currentTheme) return;
  currentTheme = theme;
  applyDocumentTheme(theme);
  try {
    window.localStorage.setItem(STORAGE_KEY, theme);
  } catch {
    // The theme still works for this session when storage is unavailable.
  }
  listeners.forEach((listener) => { listener(); });
}

export function useOperationsTheme(): OperationsTheme {
  return useSyncExternalStore(subscribe, () => currentTheme, () => "light");
}
