export interface CompatibleSidebarSlots {
  register: (
    options: Record<string, unknown>,
    component: unknown,
  ) => () => void;
}

export function registerCreatorLauncher(
  slots: CompatibleSidebarSlots,
  component: unknown,
  locale: string,
): () => void {
  return slots.register({
    name: "sidebar.footer.action",
    id: "jacky-creator-launcher",
    order: 90,
    locale,
  }, component);
}
