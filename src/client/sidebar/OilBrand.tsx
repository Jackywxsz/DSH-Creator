import { JACKY_CREATOR_MASCOT_FULL_SRC } from "../assets/jackyCreatorMascotFull.ts";

export function OilBrand({ compact = false, name = "Jacky Creator" }: { compact?: boolean; name?: string }) {
  return (
    <span className="oilBrand">
      <span className="oilBrandMark" aria-hidden="true">
        <img className="oilBrandIcon" src={JACKY_CREATOR_MASCOT_FULL_SRC} alt="" />
      </span>
      {!compact && <span className="oilBrandText">{name}</span>}
    </span>
  );
}
