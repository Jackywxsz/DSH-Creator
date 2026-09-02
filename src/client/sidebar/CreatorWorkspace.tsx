import { useEffect, useRef, useState, type CSSProperties } from "react";
import {
  IconBrowseOutline16,
  IconDataOutline16,
  IconNewChatOutline16,
} from "@deepseek-ai/dsh-client-ui-primitives";
import type { PropsLocale, PropsRuntime } from "@deepseek-ai/dsh-client-ui-slots";

import { ContentInspector } from "../ContentInspector.tsx";
import {
  contentInspectorIsVisible,
  openContentDetails,
  setContentInspectorVisible,
  setSidebarTab,
  useContentInspectorVisible,
  useSelectedContentId,
  useSidebarTab,
} from "../contentSelection.ts";
import type { CreatorViewFace } from "../face.ts";
import type { CreatorCockpitFace } from "../operations/face.ts";
import { OperationsWorkspace } from "../operations/OperationsWorkspace.tsx";
import { useOperationsTheme } from "../operations/operationsTheme.ts";
import { ContentSidebarPanel } from "./ContentSidebarPanel.tsx";
import { OilBrand } from "./OilBrand.tsx";
import { OperationsSidebarPanel } from "./OperationsSidebarPanel.tsx";
import { createWorkspaceEscapeHandler } from "./workspaceEscape.ts";
import "./OilSidebarRoot.css";
import "./CreatorWorkspace.css";

export type CreatorWorkspaceProps = PropsRuntime<"shell.overlay"> & PropsLocale<"dsh.jacky.creator"> & {
  content: CreatorViewFace;
  cockpit: CreatorCockpitFace;
};

function hostLayout(root: HTMLElement): {
  frame: HTMLElement | null;
  sidebar: HTMLElement | null;
  conversation: HTMLElement | null;
} {
  const overlay = root.parentElement;
  const frame = overlay?.hasAttribute("data-shell-overlay") === true ? overlay.parentElement : overlay;
  const sidebar = frame?.firstElementChild;
  const scrollport = document.querySelector("[data-conversation-scroll]");
  const conversation = scrollport?.parentElement;
  return {
    frame,
    sidebar: sidebar instanceof HTMLElement ? sidebar : null,
    conversation: conversation instanceof HTMLElement ? conversation : null,
  };
}

function hostSidebarWidth(root: HTMLElement): number {
  const fallback = window.matchMedia("(max-width: 1179px)").matches ? 56 : 280;
  const { frame, sidebar, conversation } = hostLayout(root);
  if (frame === null) return fallback;
  const frameLeft = frame.getBoundingClientRect().left;
  if (conversation !== null) {
    const width = Math.round(conversation.getBoundingClientRect().left - frameLeft);
    if (width >= 56 && width <= 420) return width;
  }
  if (sidebar !== null) {
    const width = Math.round(sidebar.getBoundingClientRect().width);
    if (width >= 56 && width <= 420) return width;
  }
  const firstColumn = Number.parseFloat(getComputedStyle(frame).gridTemplateColumns.split(" ")[0] ?? "");
  return Number.isFinite(firstColumn) && firstColumn >= 56 && firstColumn <= 420 ? firstColumn : fallback;
}

export function CreatorWorkspace({ t, useSessions, useWorkspaces, content, cockpit }: CreatorWorkspaceProps) {
  const root = useRef<HTMLDivElement>(null);
  const tab = useSidebarTab();
  const [selectedId] = useSelectedContentId();
  const inspectorVisible = useContentInspectorVisible();
  const theme = useOperationsTheme();
  const currentSessionId = useSessions((sessions) => sessions.current);
  const [sidebarWidth, setSidebarWidth] = useState(280);
  const [navigationOpen, setNavigationOpen] = useState(true);

  useEffect(() => { setNavigationOpen(true); }, [tab]);

  useEffect(() => {
    const element = root.current;
    if (element === null) return;
    const { frame, sidebar, conversation } = hostLayout(element);
    if (frame === null) return;
    const measure = (): void => { setSidebarWidth(hostSidebarWidth(element)); };
    measure();
    const resize = typeof ResizeObserver === "undefined" ? undefined : new ResizeObserver(measure);
    resize?.observe(frame);
    if (sidebar !== null) resize?.observe(sidebar);
    if (conversation !== null) resize?.observe(conversation);
    const onTransitionEnd = (event: TransitionEvent): void => {
      if (event.propertyName === "grid-template-columns") measure();
    };
    frame.addEventListener("transitionend", onTransitionEnd);
    window.addEventListener("resize", measure);
    const animation = window.requestAnimationFrame(measure);
    return () => {
      resize?.disconnect();
      frame.removeEventListener("transitionend", onTransitionEnd);
      window.removeEventListener("resize", measure);
      window.cancelAnimationFrame(animation);
    };
  }, [currentSessionId]);

  useEffect(() => {
    const close = (): void => {
      if (tab === "content" && contentInspectorIsVisible()) {
        setContentInspectorVisible(false);
        if (window.matchMedia("(max-width: 1179px)").matches) setSidebarTab("sessions");
        return;
      }
      setSidebarTab("sessions");
    };
    const handler = createWorkspaceEscapeHandler(
      close,
      () => typeof document === "undefined" ? undefined : document,
    ) as (event: KeyboardEvent) => void;
    window.addEventListener("keydown", handler, true);
    return () => { window.removeEventListener("keydown", handler, true); };
  }, [tab]);

  const style = { "--oil-sidebar-width": `${sidebarWidth}px` } as CSSProperties;
  const closeContentDetails = (): void => {
    setContentInspectorVisible(false);
    if (window.matchMedia("(max-width: 1179px)").matches) setSidebarTab("sessions");
  };
  const chooseTab = (next: "sessions" | "content" | "operations"): void => {
    if (next === "content" && tab !== "content") setContentInspectorVisible(false);
    setSidebarTab(next);
  };

  return (
    <div
      ref={root}
      className={`jackyCreatorWorkspace ${tab} ${navigationOpen ? "navigationOpen" : ""} ${inspectorVisible ? "hasSelection" : ""}`}
      style={style}
    >
      <aside
        className={tab === "operations" ? "jackyWorkspaceSidebar operationsTheme" : "jackyWorkspaceSidebar"}
        data-plugin="jacky-creator"
        data-surface="sidebar"
        data-cockpit-theme={tab === "operations" ? theme : undefined}
        aria-label={t("workspace.title")}
      >
        <div className="logoRow">
          <div className="brandButton wide"><OilBrand /></div>
        </div>
        <div className="tabRow">
          <div className="tabList" role="tablist" aria-label={t("workspace.title")}>
            <button type="button" role="tab" aria-selected={false} className="tabButton" onClick={() => { chooseTab("sessions"); }}>
              <IconNewChatOutline16 size={14} />{t("tab.sessions")}
            </button>
            <button type="button" role="tab" aria-selected={tab === "content"} className={tab === "content" ? "tabButton active" : "tabButton"} onClick={() => { chooseTab("content"); }}>
              <IconBrowseOutline16 size={14} />{t("tab.content")}
            </button>
            <button type="button" role="tab" aria-selected={tab === "operations"} className={tab === "operations" ? "tabButton active" : "tabButton"} onClick={() => { chooseTab("operations"); }}>
              <IconDataOutline16 size={14} />{t("tab.operations")}
            </button>
          </div>
        </div>
        <div className="regionArea">
          {tab === "content" && <ContentSidebarPanel {...content} t={t} />}
          {tab === "operations" && <OperationsSidebarPanel t={t} onNavigate={() => { setNavigationOpen(false); }} />}
        </div>
      </aside>

      {tab === "content" && selectedId !== null && inspectorVisible && (
        <ContentInspector
          {...content}
          cockpit={cockpit}
          t={t}
          useSessions={useSessions}
          useWorkspaces={useWorkspaces}
          sidebarWidth={sidebarWidth}
          closeDetails={closeContentDetails}
        />
      )}
      {tab === "operations" && (
        <OperationsWorkspace
          {...content}
          {...cockpit}
          t={t}
          openContent={(id) => {
            openContentDetails(id);
            setSidebarTab("content");
          }}
        />
      )}
      {tab === "operations" && !navigationOpen && (
        <button type="button" className="jackyWorkspaceMenu" onClick={() => { setNavigationOpen(true); }}>
          {t("workspace.menu")}
        </button>
      )}
    </div>
  );
}
