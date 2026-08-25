import { useEffect } from "react";

interface InputState {
  draft: string;
  phase: string;
}

interface InputActions {
  setDraft: (text: string) => void;
  submit: () => void;
}

interface BridgeProps {
  session: { sessionId: string };
  input: InputState;
  inputActions: InputActions;
}

interface ActiveBridge {
  sessionId: string;
  input: InputState;
  actions: InputActions;
}

let active: ActiveBridge | undefined;

export function CockpitSessionBridge({ session, input, inputActions }: BridgeProps) {
  useEffect(() => {
    const bridge = { sessionId: session.sessionId, input, actions: inputActions };
    active = bridge;
    return () => {
      if (active === bridge) active = undefined;
    };
  }, [session.sessionId, input, inputActions]);
  return null;
}

export function sendCockpitInstruction(text: string): boolean {
  if (active === undefined || active.input.phase === "submitting" || active.input.phase === "adjudicating") return false;
  if (active.input.draft.trim() !== "") return false;
  active.actions.setDraft(text);
  active.actions.submit();
  return true;
}
