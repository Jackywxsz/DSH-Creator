const DESKTOP_BREAKPOINT = 1180;
const LARGE_DESKTOP_BREAKPOINT = 1440;
export const INSPECTOR_MIN = 420;
export const INSPECTOR_MAX = 720;
export const INSPECTOR_DEFAULT = 560;

export interface InspectorGeometry {
  docked: boolean;
  width: number;
}

export function constrainInspectorGeometry(
  requestedWidth: number,
  viewportWidth: number,
  sidebarWidth: number,
): InspectorGeometry {
  const contentWidth = Math.max(0, viewportWidth - sidebarWidth);
  if (viewportWidth < DESKTOP_BREAKPOINT) return { docked: false, width: contentWidth };

  const conversationMin = viewportWidth >= LARGE_DESKTOP_BREAKPOINT ? 520 : 480;
  const tierMax = viewportWidth >= LARGE_DESKTOP_BREAKPOINT ? INSPECTOR_MAX : 520;
  const availableMax = contentWidth - conversationMin;
  if (availableMax < INSPECTOR_MIN) return { docked: false, width: contentWidth };
  const width = Math.min(
    Math.max(INSPECTOR_MIN, Math.round(requestedWidth)),
    tierMax,
    availableMax,
  );
  return { docked: true, width };
}
