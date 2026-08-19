export interface CompatibleSettingsSlots {
  register: (
    options: Record<string, unknown>,
    component: unknown,
  ) => () => void;
}

export function registerCreatorSettingsCard(
  slots: CompatibleSettingsSlots,
  component: unknown,
  options: {
    namespace: string;
    legacyId: string;
    legacyOrder: number;
    locale: string;
    inject: () => object;
  },
): () => void {
  return slots.register({
    name: "settings.plugin.item",
    key: options.namespace,
    id: options.legacyId,
    order: options.legacyOrder,
    locale: options.locale,
    inject: options.inject,
  }, component);
}
