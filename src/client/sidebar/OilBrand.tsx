import { OIL_ICON_SRC } from "../assets/oilIcon.ts";

export function OilBrand({ compact = false, name = "Oil Creator" }: { compact?: boolean; name?: string }) {
  return (
    <span className="oilBrand">
      <img className="oilBrandIcon" src={OIL_ICON_SRC} alt="" aria-hidden="true" />
      {!compact && <span className="oilBrandText">{name}</span>}
    </span>
  );
}
