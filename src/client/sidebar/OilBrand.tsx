import { OIL_ICON_SRC } from "../assets/oilIcon.ts";

export function OilBrand({ compact = false }: { compact?: boolean }) {
  return (
    <span className="oilBrand">
      <img className="oilBrandIcon" src={OIL_ICON_SRC} alt="" aria-hidden="true" />
      {!compact && <span className="oilBrandText">Oil Creator</span>}
    </span>
  );
}
