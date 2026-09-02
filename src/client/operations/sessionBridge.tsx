import { useEffect, useLayoutEffect, useState } from "react";

import type { ContentDetail } from "../../types.ts";
import {
  setSelectedContentId,
  useSelectedContentId,
  useSidebarTab,
} from "../contentSelection.ts";
import type { CreatorKey } from "../locales.ts";
import "./sessionBridge.css";

type InputPhase = "plain" | "adjudicating" | "claimed" | "submitting";

interface InputState {
  readonly draft: string;
  readonly phase: InputPhase;
}

interface InputActions {
  readonly setDraft: (text: string) => void;
  readonly submit: () => void;
}

interface BridgeProps {
  session: { sessionId: string };
  input: InputState;
  inputActions: InputActions;
  getContent: (id: string) => Promise<ContentDetail>;
  t: (key: CreatorKey) => string;
}

interface ActiveBridge {
  sessionId: string;
  input: InputState;
  actions: InputActions;
}

let active: ActiveBridge | undefined;

export function CockpitSessionBridge({ session, input, inputActions, getContent, t }: BridgeProps) {
  const tab = useSidebarTab();
  const [selectedId] = useSelectedContentId();
  const [title, setTitle] = useState("");
  useLayoutEffect(() => {
    const bridge = { sessionId: session.sessionId, input, actions: inputActions };
    active = bridge;
    return () => {
      if (active === bridge) active = undefined;
    };
  }, [session.sessionId, input, inputActions]);
  useEffect(() => {
    let live = true;
    setTitle("");
    if (selectedId === null) return () => { live = false; };
    void getContent(selectedId).then((detail) => {
      if (live) setTitle(detail.title);
    }, () => undefined);
    return () => { live = false; };
  }, [selectedId, getContent]);

  if (tab !== "content" || selectedId === null) return null;
  const locked = input.phase === "submitting" || input.phase === "adjudicating";
  return (
    <div className="jackyCurrentContent" role="group" aria-label={t("context.current")}>
      <span>{t("context.current")}</span>
      <strong title={title || selectedId}>{title || selectedId}</strong>
      <button
        type="button"
        disabled={locked}
        onClick={() => { inputActions.setDraft(appendContentReference(input.draft)); }}
      >
        {t("context.quote")}
      </button>
      <button type="button" onClick={() => { setSelectedContentId(null); }}>
        {t("context.clear")}
      </button>
    </div>
  );
}

export function appendContentReference(draft: string): string {
  if (draft.includes("/current content")) return draft;
  return `${draft}${draft === "" || draft.endsWith("\n") ? "" : "\n"}/current content`;
}

export function sendCockpitInstruction(text: string): boolean {
  return submitCockpitInstruction(active, text);
}

export function submitCockpitInstruction(bridge: ActiveBridge | undefined, text: string): boolean {
  if (bridge === undefined || bridge.input.phase !== "plain") return false;
  if (bridge.input.draft.trim() !== "") return false;
  bridge.actions.setDraft(text);
  bridge.actions.submit();
  return true;
}
