export const MODAL_LAYER_SELECTOR = '[role="dialog"],[aria-modal="true"]';

export interface EscapeSignal {
  key: string;
  isComposing?: boolean;
  repeat?: boolean;
}

export function modalLayerOpen(root: ParentNode | undefined): boolean {
  return root?.querySelector(MODAL_LAYER_SELECTOR) != null;
}

export function createWorkspaceEscapeHandler(
  onClose: () => void,
  getRoot: () => ParentNode | undefined,
): (event: EscapeSignal) => void {
  return (event) => {
    if (event.key !== "Escape" || event.isComposing === true || event.repeat === true) return;
    if (modalLayerOpen(getRoot())) return;
    onClose();
  };
}
