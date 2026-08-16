import { useEffect, useState } from "react";
import { IconChevronDownOutline14 } from "@deepseek-ai/dsh-client-ui-primitives";
import type { InjectFace, PropsLocale, PropsRuntime } from "@deepseek-ai/dsh-client-ui-slots";

import { COVER_KEY_REFS, SUBTITLE_KEY_REFS } from "../secrets.ts";
import type { CreatorProfile, CreatorSecrets } from "../types.ts";
import type { CredentialsClient, SecretDraft } from "./credentialsApi.ts";
import { applyDescribed, secretDraftOf } from "./credentialsApi.ts";
import type { CreatorViewFace } from "./face.ts";
import type { CreatorKey } from "./locales.ts";
import { ActionBar, ActionButton } from "./ui/ActionButton.tsx";
import "./CreatorSettingsCard.css";

declare module "@deepseek-ai/dsh-client-ui-slots" {
  interface SlotMap {
    "settings.plugin.item": { kind: "list"; scope: "root"; owner: { children?: never } };
  }
}

export type CreatorSettingsCardProps =
  & PropsRuntime<"settings.plugin.item">
  & PropsLocale<"dsh.oil.creator">
  & InjectFace<
    Pick<CreatorViewFace, "ready" | "getSettings" | "setLibraryRoot" | "setProfile" | "pickDirectory">
    & { credentials: CredentialsClient | undefined }
  >;

const EMPTY_SECRETS: CreatorSecrets = {
  subtitle: { kind: "subtitle", ref: SUBTITLE_KEY_REFS[0], configured: false, writable: true },
  cover: { kind: "cover", ref: COVER_KEY_REFS[0], configured: false, writable: true },
};

const EMPTY_PROFILE: CreatorProfile = { platforms: {} };

function cloneProfile(profile: CreatorProfile): CreatorProfile {
  return {
    platforms: { ...profile.platforms },
  };
}

function sameProfile(left: CreatorProfile, right: CreatorProfile): boolean {
  return (left.platforms.xiaohongshu ?? "") === (right.platforms.xiaohongshu ?? "")
    && (left.platforms.douyin ?? "") === (right.platforms.douyin ?? "")
    && (left.platforms.bilibili ?? "") === (right.platforms.bilibili ?? "")
    && (left.platforms.wechat ?? "") === (right.platforms.wechat ?? "")
    && (left.platforms.youtube ?? "") === (right.platforms.youtube ?? "");
}

export function CreatorSettingsCard({
  t,
  ready,
  getSettings,
  setLibraryRoot,
  setProfile,
  pickDirectory,
  credentials,
}: CreatorSettingsCardProps) {
  const [open, setOpen] = useState(false);
  const [savedRoot, setSavedRoot] = useState("");
  const [draftRoot, setDraftRoot] = useState("");
  const [savedProfile, setSavedProfile] = useState<CreatorProfile>(EMPTY_PROFILE);
  const [draftProfile, setDraftProfile] = useState<CreatorProfile>(EMPTY_PROFILE);
  const [secrets, setSecrets] = useState<SecretDraft[]>([
    secretDraftOf(EMPTY_SECRETS.subtitle),
    secretDraftOf(EMPTY_SECRETS.cover),
  ]);
  const [loaded, setLoaded] = useState(false);
  const [saving, setSaving] = useState(false);
  const [failed, setFailed] = useState(false);
  const [saved, setSaved] = useState(false);
  const [keyFailed, setKeyFailed] = useState(false);

  useEffect(() => {
    if (!ready()) return;
    let cancelled = false;
    void getSettings().then((settings) => {
      if (cancelled) return;
      setSavedRoot(settings.libraryRoot);
      setDraftRoot(settings.libraryRoot);
      setSavedProfile(cloneProfile(settings.profile));
      setDraftProfile(cloneProfile(settings.profile));
      const nextSecrets = settings.secrets ?? EMPTY_SECRETS;
      setSecrets([
        secretDraftOf(nextSecrets.subtitle),
        secretDraftOf(nextSecrets.cover),
      ]);
      setLoaded(true);
    }, () => {
      if (!cancelled) setLoaded(true);
    });
    return () => {
      cancelled = true;
    };
  }, [ready, getSettings]);

  useEffect(() => {
    if (!open || credentials === undefined) return;
    let cancelled = false;
    const refs = secrets.map((item) => item.ref);
    void credentials.describe({ refs }).then((response) => {
      if (cancelled || !response.result.ok || response.result.value === undefined) {
        if (!cancelled && (response.result.ok !== true)) {
          setSecrets((current) => current.map((item) => ({ ...item, loadError: true })));
        }
        return;
      }
      const described = response.result.value.credentials;
      setSecrets((current) => current.map((item) => applyDescribed(item, described)));
    }, () => {
      if (!cancelled) setSecrets((current) => current.map((item) => ({ ...item, loadError: true })));
    });
    return () => {
      cancelled = true;
    };
  }, [open, credentials, secrets.map((item) => item.ref).join(",")]);

  const dirtyRoot = draftRoot !== savedRoot;
  const dirtyProfile = !sameProfile(draftProfile, savedProfile);
  const dirtyKeys = secrets.some((item) => item.nextValue.trim() !== "");
  const dirty = dirtyRoot || dirtyProfile || dirtyKeys;
  const title = t("settings.title" as CreatorKey);

  const onPick = async () => {
    const path = await pickDirectory();
    if (path === null) return;
    setDraftRoot(path);
    setSaved(false);
    setFailed(false);
  };

  const patchProfile = (patch: Partial<CreatorProfile> | { platform: keyof CreatorProfile["platforms"]; value: string }) => {
    setDraftProfile((current) => {
      if ("platform" in patch) {
        const platforms = { ...current.platforms };
        if (patch.value.trim() === "") delete platforms[patch.platform];
        else platforms[patch.platform] = patch.value;
        return { ...current, platforms };
      }
      return { ...current, ...patch };
    });
    setSaved(false);
    setFailed(false);
  };

  const onSave = async () => {
    if (!dirty || saving) return;
    if (dirtyRoot && draftRoot === "") return;
    setSaving(true);
    setFailed(false);
    setKeyFailed(false);
    setSaved(false);
    try {
      if (dirtyKeys) {
        if (credentials === undefined) {
          setKeyFailed(true);
          return;
        }
        for (const item of secrets) {
          const value = item.nextValue.trim();
          if (value === "") continue;
          if (!(await credentials.set({ ref: item.ref, value })).result.ok) {
            setKeyFailed(true);
            return;
          }
        }
        setSecrets((current) => current.map((item) => (
          item.nextValue.trim() === ""
            ? item
            : { ...item, nextValue: "", configured: true, loadError: false }
        )));
      }
      if (dirtyRoot) {
        await setLibraryRoot(draftRoot);
        setSavedRoot(draftRoot);
      }
      if (dirtyProfile) {
        await setProfile(draftProfile);
        setSavedProfile(cloneProfile(draftProfile));
      }
      setSaved(true);
    } catch {
      setFailed(true);
    } finally {
      setSaving(false);
    }
  };

  return (
    <li data-plugin="dsh-oil-creator" data-surface="settings-card" className={open ? "card open" : "card"}>
      <button
        type="button"
        className="header"
        aria-expanded={open}
        aria-label={`${t((open ? "settings.collapse" : "settings.expand") as CreatorKey)}: ${title}`}
        onClick={() => { setOpen(!open); }}
      >
        <span className="headText">
          <span className="name">{title}</span>
          <span className="description">{t("settings.description" as CreatorKey)}</span>
        </span>
        {dirty && <span className="pending">{t("settings.save" as CreatorKey)}</span>}
        <IconChevronDownOutline14 className={open ? "chevron open" : "chevron"} />
      </button>
      {open && (
        <div className="body">
          <label className="field">
            <span className="fieldLabel">{t("settings.libraryRoot" as CreatorKey)}</span>
            <span className="fieldHint">{t("settings.libraryRootHint" as CreatorKey)}</span>
            <span className="pathRow">
              <span className={draftRoot === "" ? "path empty" : "path"}>
                {draftRoot === "" ? t("settings.libraryRootEmpty" as CreatorKey) : draftRoot}
              </span>
              <ActionButton onClick={() => { void onPick(); }}>
                {t("settings.pick" as CreatorKey)}
              </ActionButton>
            </span>
          </label>
          <div className="field">
            <span className="fieldLabel">{t("settings.profile" as CreatorKey)}</span>
            <span className="fieldHint">{t("settings.profileHint" as CreatorKey)}</span>
            {([
              "xiaohongshu",
              "douyin",
              "bilibili",
              "wechat",
              "youtube",
            ] as const).map((platform) => (
              <label className="inputLabel" key={platform}>
                <span>{t(`settings.platform.${platform}` as CreatorKey)}</span>
                <input
                  className="input"
                  value={draftProfile.platforms[platform] ?? ""}
                  onChange={(event) => { patchProfile({ platform, value: event.target.value }); }}
                />
              </label>
            ))}
          </div>
          <div className="field">
            <span className="fieldLabel">{t("settings.secrets" as CreatorKey)}</span>
            <span className="fieldHint">{t("settings.secretsHint" as CreatorKey)}</span>
            {secrets.map((item) => (
              <label className="inputLabel" key={item.kind}>
                <span className="secretHead">
                  <span>{t(`settings.secret.${item.kind}` as CreatorKey)}</span>
                  <span className={`badge ${item.configured ? "ok" : "muted"}`}>
                    {t((
                      item.loadError
                        ? "settings.secret.loadFailed"
                        : item.configured
                          ? "settings.secret.configured"
                          : "settings.secret.missing"
                    ) as CreatorKey)}
                  </span>
                </span>
                <span className="fieldHint">{t(`settings.secret.${item.kind}Hint` as CreatorKey)}</span>
                <input
                  className="input"
                  type="password"
                  autoComplete="off"
                  placeholder={t("settings.secret.placeholder" as CreatorKey)}
                  disabled={!item.writable || saving}
                  value={item.nextValue}
                  onChange={(event) => {
                    const value = event.target.value;
                    setSecrets((current) => current.map((row) => (
                      row.kind === item.kind ? { ...row, nextValue: value } : row
                    )));
                    setSaved(false);
                    setFailed(false);
                    setKeyFailed(false);
                  }}
                />
                {!item.writable && (
                  <span className="fieldHint">{t("settings.secret.readOnly" as CreatorKey)}</span>
                )}
              </label>
            ))}
          </div>
          <div className="footer">
            {failed && <p className="failed" role="status">{t("settings.saveFailed" as CreatorKey)}</p>}
            {keyFailed && <p className="failed" role="status">{t("settings.secret.saveFailed" as CreatorKey)}</p>}
            {saved && !dirty && <p className="ok" role="status">{t("settings.saved" as CreatorKey)}</p>}
            <ActionBar>
              <ActionButton
                disabled={!dirty || saving || !loaded}
                onClick={() => {
                  setDraftRoot(savedRoot);
                  setDraftProfile(cloneProfile(savedProfile));
                  setSecrets((current) => current.map((item) => ({ ...item, nextValue: "" })));
                  setFailed(false);
                  setKeyFailed(false);
                  setSaved(false);
                }}
              >
                {t("settings.discard" as CreatorKey)}
              </ActionButton>
              <ActionButton
                tone="primary"
                disabled={!dirty || saving || (dirtyRoot && draftRoot === "")}
                onClick={() => { void onSave(); }}
              >
                {t((saving ? "settings.saving" : "settings.save") as CreatorKey)}
              </ActionButton>
            </ActionBar>
          </div>
        </div>
      )}
    </li>
  );
}
