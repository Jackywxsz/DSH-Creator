import { getSidebarTab, setSidebarTab, useSidebarTab } from "../contentSelection.ts";
import { JackySproutIcon } from "./JackySproutIcon.tsx";
import "./CreatorLauncher.css";

export interface CreatorLauncherProps {
  wide: boolean;
  label: string;
  expandSidebar: () => void;
}

export function CreatorLauncher({ wide, label, expandSidebar }: CreatorLauncherProps) {
  const active = useSidebarTab() !== "sessions";
  return (
    <button
      type="button"
      className="jackyCreatorLauncher"
      aria-pressed={active}
      title={label}
      onClick={() => {
        if (getSidebarTab() !== "sessions") {
          setSidebarTab("sessions");
          return;
        }
        if (!wide && window.matchMedia("(min-width: 1180px)").matches) expandSidebar();
        setSidebarTab("content");
      }}
    >
      <JackySproutIcon size={17} />
      {wide ? <span>{label}</span> : null}
    </button>
  );
}
