import { JACKY_CREATOR_MASCOT_SRC } from "../assets/jackyCreatorMascot.ts";

export function OilBrand({ compact = false, name = "Jacky Creator" }: { compact?: boolean; name?: string }) {
  return (
    <span className="oilBrand">
      <img className="oilBrandIcon" src={JACKY_CREATOR_MASCOT_SRC} alt="" aria-hidden="true" />
      {!compact && <span className="oilBrandText">{name}</span>}
    </span>
  );
}
