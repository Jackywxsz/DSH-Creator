import {
  IconChecklistOutlineMedium,
  IconDataOutlineMedium,
  IconGoalOutlineMedium,
  IconListPenOutlineMedium,
} from "@deepseek-ai/dsh-client-ui-primitives";

import {
  setOperationsSection,
  type OperationsSection,
  useOperationsSection,
} from "../contentSelection.ts";
import type { CreatorKey } from "../locales.ts";
import { setOperationsTheme, useOperationsTheme } from "../operations/operationsTheme.ts";
import { JackySproutIcon } from "./JackySproutIcon.tsx";
import "./OperationsSidebarPanel.css";

const SECTIONS: Array<{
  id: OperationsSection;
  label: CreatorKey;
  icon: typeof IconDataOutlineMedium | typeof JackySproutIcon;
}> = [
  { id: "ideas", label: "operations.nav.ideas", icon: JackySproutIcon },
  { id: "today", label: "operations.nav.today", icon: IconChecklistOutlineMedium },
  { id: "schedule", label: "operations.nav.schedule", icon: IconListPenOutlineMedium },
  { id: "content", label: "operations.nav.content", icon: IconDataOutlineMedium },
  { id: "goals", label: "operations.nav.goals", icon: IconGoalOutlineMedium },
  { id: "reviews", label: "operations.nav.reviews", icon: IconListPenOutlineMedium },
  { id: "settings", label: "operations.nav.settings", icon: IconDataOutlineMedium },
];

export function OperationsSidebarPanel({ t, onNavigate }: { t: (key: CreatorKey) => string; onNavigate?: () => void }) {
  const active = useOperationsSection();
  const theme = useOperationsTheme();
  const themeLabel = theme === "dark" ? "浅色模式" : "深色模式";

  return (
    <nav
      className="operationsPanel"
      aria-label={t("operations.nav.label")}
      data-cockpit-theme={theme}
    >
      <div className="operationsNavCaption">{t("operations.nav.label")}</div>
      <div className="operationsNavList">
        {SECTIONS.map((section) => {
          const Icon = section.icon;
          return (
            <button
              key={section.id}
              type="button"
              className={section.id === active ? "operationsNavItem active" : "operationsNavItem"}
              aria-label={t(section.label)}
              aria-current={section.id === active ? "page" : undefined}
              onClick={() => { setOperationsSection(section.id); onNavigate?.(); }}
            >
              <Icon size={16} />
              <span>{t(section.label)}</span>
            </button>
          );
        })}
      </div>
      <button
        type="button"
        className="operationsThemeToggle"
        aria-label={themeLabel}
        aria-pressed={theme === "dark"}
        onClick={() => { setOperationsTheme(theme === "dark" ? "light" : "dark"); }}
      >
        <span aria-hidden="true">{theme === "dark" ? "☀" : "◐"}</span>
        <strong>{themeLabel}</strong>
        <i aria-hidden="true"><b /></i>
      </button>
      <div className="operationsVersion">Jacky Creator · 运营 v0.3</div>
    </nav>
  );
}
