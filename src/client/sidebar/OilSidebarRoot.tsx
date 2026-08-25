import { useEffect, useRef, useState } from "react";
import {
  IconBrowseOutline16,
  IconDataOutline16,
  IconNewChatOutline16,
  IconPanelLeftOutline16,
  Tooltip,
} from "@deepseek-ai/dsh-client-ui-primitives";

import type { CreatorViewFace } from "../face.ts";
import type { CreatorKey } from "../locales.ts";
import {
  setSidebarChromeWidth,
  requestIdeaCapture,
  setOperationsSection,
  setSidebarTab,
  useSidebarTab,
} from "../contentSelection.ts";
import { ContentSidebarPanel } from "./ContentSidebarPanel.tsx";
import { OilBrand } from "./OilBrand.tsx";
import { JackySproutIcon } from "./JackySproutIcon.tsx";
import { OperationsSidebarPanel } from "./OperationsSidebarPanel.tsx";
import type { OilSidebarSlotProps } from "./slots.ts";
import "./OilSidebarRoot.css";

const COLLAPSE_SETTLE_MS = 150;
const SCROLLBAR_LINGER_MS = 2000;

function cx(...parts: Array<string | false | undefined>): string {
  return parts.filter((part): part is string => typeof part === "string" && part !== "").join(" ");
}

export type OilSidebarRootProps =
  & OilSidebarSlotProps
  & {
    tabLabels: { sessions: string; content: string; operations: string };
    contentFace: CreatorViewFace;
    contentT: (key: CreatorKey) => string;
  };

export function OilSidebarRoot({
  collapsed,
  width,
  startSession,
  toggleSidebar,
  t,
  renderSlot,
  tabLabels,
  contentFace,
  contentT,
}: OilSidebarRootProps) {
  const [settled, setSettled] = useState(collapsed);
  useEffect(() => {
    if (!collapsed) {
      setSettled(false);
      return;
    }
    const timer = window.setTimeout(() => { setSettled(true); }, COLLAPSE_SETTLE_MS);
    return () => { window.clearTimeout(timer); };
  }, [collapsed]);

  const wide = !collapsed || !settled;
  const lastWideWidth = useRef(width);
  if (!collapsed) lastWideWidth.current = width;

  const everWide = useRef(!collapsed);
  if (!collapsed) everWide.current = true;

  const sidebarTab = useSidebarTab();

  const chooseTab = (tab: typeof sidebarTab): void => {
    setSidebarTab(tab);
    if (tab === "operations" && !collapsed && window.matchMedia("(max-width: 620px)").matches) {
      toggleSidebar();
    }
  };



  const column = useRef<HTMLDivElement>(null);
  const [pointerInside, setPointerInside] = useState(false);
  const lingerTimer = useRef<number | undefined>(undefined);

  const armLinger = (): void => {
    if (lingerTimer.current !== undefined) return;
    lingerTimer.current = window.setTimeout(() => {
      lingerTimer.current = undefined;
      setPointerInside(false);
    }, SCROLLBAR_LINGER_MS);
  };

  const cancelLinger = (): void => {
    window.clearTimeout(lingerTimer.current);
    lingerTimer.current = undefined;
  };

  useEffect(() => {
    if (!pointerInside) return;
    const onMove = (event: PointerEvent): void => {
      const rect = column.current?.getBoundingClientRect();
      if (rect === undefined) return;
      const inside = event.clientX >= rect.left && event.clientX < rect.right
        && event.clientY >= rect.top && event.clientY < rect.bottom;
      if (inside) cancelLinger();
      else armLinger();
    };
    document.addEventListener("pointermove", onMove);
    return () => {
      document.removeEventListener("pointermove", onMove);
      cancelLinger();
    };
  }, [pointerInside]);

  const [contentMounted, setContentMounted] = useState(sidebarTab === "content");
  const [operationsMounted, setOperationsMounted] = useState(sidebarTab === "operations");
  useEffect(() => {
    if (sidebarTab === "content") setContentMounted(true);
    if (sidebarTab === "operations") setOperationsMounted(true);
  }, [sidebarTab]);

  const sessionsVisible = !wide || sidebarTab === "sessions";
  const contentVisible = wide && sidebarTab === "content";
  const operationsVisible = wide && sidebarTab === "operations";

  useEffect(() => {
    setSidebarChromeWidth(!wide ? 56 : collapsed ? lastWideWidth.current : width);
  }, [wide, collapsed, width]);

  return (
    <div
      ref={column}
      data-plugin="dsh-oil-creator"
      data-surface="sidebar"
      className={cx(
        sidebarTab === "operations" && "operationsTheme",
        !wide && "collapsed",
        !wide && everWide.current && "railIn",
        collapsed && wide && "fading",
        !pointerInside && "quietBars",
      )}
      style={wide ? { width: collapsed ? lastWideWidth.current : width } : undefined}
      onPointerEnter={() => {
        cancelLinger();
        setPointerInside(true);
      }}
      onPointerLeave={() => { armLinger(); }}
    >
      <div className="logoRow">
        {wide && (
          <button
            type="button"
            className={cx("brandButton", "wide")}
            aria-label={t("session.new.label")}
            onClick={() => { startSession(); }}
          >
            <OilBrand />
          </button>
        )}
        <Tooltip label={collapsed ? t("toggle.open") : t("toggle.collapse")} delayMs={500}>
          <button
            type="button"
            className={cx("iconButton", "toggle")}
            aria-label={collapsed ? t("toggle.open") : t("toggle.collapse")}
            onClick={() => { toggleSidebar(); }}
          >
            {!wide && (
              <span className="railBrand">
                <OilBrand compact />
              </span>
            )}
            <IconPanelLeftOutline16 className="panelIcon" size={wide ? 16 : 18} />
          </button>
        </Tooltip>
      </div>

      {!wide && (
        <Tooltip label={t("session.new.label")} delayMs={500}>
          <button
            type="button"
            className="newSession"
            aria-label={t("session.new.label")}
            onClick={() => { startSession(); }}
          >
            <IconNewChatOutline16 size={18} />
          </button>
        </Tooltip>
      )}

      {wide && (
        <div className="tabRow">
          <div className="tabList" role="tablist" aria-label={tabLabels.sessions}>
            <button
              type="button"
              role="tab"
              aria-selected={sidebarTab === "sessions"}
              className={cx("tabButton", sidebarTab === "sessions" && "active")}
              onClick={() => { chooseTab("sessions"); }}
            >
              <IconNewChatOutline16 size={14} />
              {tabLabels.sessions}
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={sidebarTab === "content"}
              className={cx("tabButton", sidebarTab === "content" && "active")}
              onClick={() => { chooseTab("content"); }}
            >
              <IconBrowseOutline16 size={14} />
              {tabLabels.content}
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={sidebarTab === "operations"}
              className={cx("tabButton", sidebarTab === "operations" && "active")}
              onClick={() => { chooseTab("operations"); }}
            >
              <IconDataOutline16 size={14} />
              {tabLabels.operations}
            </button>
          </div>
          <Tooltip label={contentT("operations.quickCapture")} delayMs={400}>
            <button
              type="button"
              className="quickIdeaButton"
              aria-label={contentT("operations.quickCapture")}
              onClick={() => {
                setSidebarTab("operations");
                setOperationsSection("ideas");
                requestIdeaCapture();
                if (!collapsed && window.matchMedia("(max-width: 620px)").matches) toggleSidebar();
              }}
            >
              <JackySproutIcon size={17} />
            </button>
          </Tooltip>
        </div>
      )}

      <div className="regionArea">
        <div className={cx("regionPane", !sessionsVisible && "hidden")}>
          {wide && (
            <div className="headerNewSession">
              <Tooltip label={t("session.new.label")} delayMs={500}>
                <button
                  type="button"
                  className="iconButton"
                  aria-label={t("session.new.label")}
                  onClick={() => { startSession(); }}
                >
                  <IconNewChatOutline16 size={16} />
                </button>
              </Tooltip>
            </div>
          )}
          {renderSlot("sidebar.workspaces", {
            wide,
            expandSidebar: () => { if (collapsed) toggleSidebar(); },
          })}
        </div>
        {contentMounted && (
          <div className={cx("regionPane", !contentVisible && "hidden")}>
            <ContentSidebarPanel
              t={contentT}
              {...contentFace}
            />
          </div>
        )}
        {operationsMounted && (
          <div className={cx("regionPane", !operationsVisible && "hidden")}>
            <OperationsSidebarPanel
              t={contentT}
              onNavigate={() => {
                if (!collapsed && window.matchMedia("(max-width: 620px)").matches) toggleSidebar();
              }}
            />
          </div>
        )}
      </div>

      <div className="footArea">
        <div className="footerActions">
          {renderSlot("sidebar.footer.action", { wide })}
        </div>
        <div className="settingsArea">
          {renderSlot("sidebar.settings", { wide })}
        </div>
      </div>
    </div>
  );
}
