import {
  IconChecklistOutline14,
  IconDataOutline16,
  IconGoalOutline16,
  IconListPenOutline16,
} from "@deepseek-ai/dsh-client-ui-primitives";

import {
  setOperationsSection,
  type OperationsSection,
  useOperationsSection,
} from "../contentSelection.ts";
import type { CreatorKey } from "../locales.ts";
import { JackySproutIcon } from "./JackySproutIcon.tsx";
import "./OperationsSidebarPanel.css";

const SECTIONS: Array<{
  id: OperationsSection;
  label: CreatorKey;
  icon: typeof IconDataOutline16 | typeof JackySproutIcon;
}> = [
  { id: "ideas", label: "operations.nav.ideas", icon: JackySproutIcon },
  { id: "today", label: "operations.nav.today", icon: IconChecklistOutline14 },
  { id: "schedule", label: "operations.nav.schedule", icon: IconListPenOutline16 },
  { id: "content", label: "operations.nav.content", icon: IconDataOutline16 },
  { id: "goals", label: "operations.nav.goals", icon: IconGoalOutline16 },
  { id: "reviews", label: "operations.nav.reviews", icon: IconListPenOutline16 },
  { id: "settings", label: "operations.nav.settings", icon: IconDataOutline16 },
];

export function OperationsSidebarPanel({ t, onNavigate }: { t: (key: CreatorKey) => string; onNavigate?: () => void }) {
  const active = useOperationsSection();

  return (
    <nav className="operationsPanel" aria-label={t("operations.nav.label")}>
      <div className="operationsNavCaption">{t("operations.nav.label")}</div>
      <div className="operationsNavList">
        {SECTIONS.map((section) => {
          const Icon = section.icon;
          return (
            <button
              key={section.id}
              type="button"
              className={section.id === active ? "operationsNavItem active" : "operationsNavItem"}
              aria-current={section.id === active ? "page" : undefined}
              onClick={() => { setOperationsSection(section.id); onNavigate?.(); }}
            >
              <Icon size={16} />
              <span>{t(section.label)}</span>
            </button>
          );
        })}
      </div>
      <div className="operationsVersion">Creator Cockpit · Operations v0.3</div>
    </nav>
  );
}
