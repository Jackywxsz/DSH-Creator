/* ----------------------------------------------------------------------------
 * OperationsLauncher
 *
 * Compact launcher contributed into the host-owned `sidebar.footer.action`
 * list slot. Toggles the shared sidebar-tab state to "operations"; the
 * shell.overlay wiring turns that into the fullscreen cockpit. Intentionally
 * `flex: none` with an intrinsic size: the host footer renders list occupants
 * in a flex row, where a stretchy item gets crushed against its siblings.
 * ------------------------------------------------------------------------- */

import { getSidebarTab, setSidebarTab, useSidebarTab } from "../contentSelection.ts";
import { JackySproutIcon } from "./JackySproutIcon.tsx";
import "./OperationsLauncher.css";

export interface OperationsLauncherProps {
  wide: boolean;
  label: string;
}

export function OperationsLauncher({ wide, label }: OperationsLauncherProps) {
  const tab = useSidebarTab();
  const active = tab === "operations";
  const toggle = (): void => {
    setSidebarTab(getSidebarTab() === "operations" ? "content" : "operations");
  };
  return (
    <button
      type="button"
      className="jackyOperationsLauncher"
      aria-pressed={active}
      title={label}
      onClick={toggle}
    >
      <JackySproutIcon size={16} />
      {wide ? <span className="jackyOperationsLauncherLabel">{label}</span> : null}
    </button>
  );
}
