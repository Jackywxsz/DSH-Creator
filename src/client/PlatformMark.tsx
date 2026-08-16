import { PLATFORM_ICONS, type PlatformId } from "./platformIcons.ts";

export type { PlatformId };

export function PlatformMark({ id, size = 18 }: { id: PlatformId; size?: number }) {
  return (
    <img
      className="platformMark"
      src={PLATFORM_ICONS[id]}
      width={size}
      height={size}
      alt=""
      draggable={false}
    />
  );
}
