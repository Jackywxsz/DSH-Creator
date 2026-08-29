import { useEffect, useState } from "react";
import { IconChevronDownOutline14 } from "@deepseek-ai/dsh-client-ui-primitives";
import type { InjectFace, PropsLocale, PropsRuntime } from "@deepseek-ai/dsh-client-ui-slots";
import type {} from "@deepseek-ai/dsh-client-ui-settings-plugins/client";

import { normalizeEnabledPlatforms } from "../platforms.ts";
import { COVER_KEY_REFS, SUBTITLE_KEY_REFS } from "../secrets.ts";
import type {
  CreatorCapabilities,
  CreatorInstallTarget,
  CreatorPlatformLogin,
  CreatorProfile,
  CreatorSecrets,
  PublishPlatform,
} from "../types.ts";
import type { CredentialsClient, SecretDraft } from "./credentialsApi.ts";
import { applyDescribed, secretDraftOf } from "./credentialsApi.ts";
import type { CreatorViewFace } from "./face.ts";
import type { CreatorKey } from "./locales.ts";
import { CREATOR_SETTINGS_PLATFORMS } from "./publishPlatforms.ts";
import { ActionBar, ActionButton } from "./ui/ActionButton.tsx";
import { StatusPill, type StatusTone } from "./ui/StatusPill.tsx";
import "./CreatorSettingsCard.css";

export type CreatorSettingsCardProps =
  & PropsRuntime<"settings.plugin.item">
  & PropsLocale<"dsh.jacky.creator">
  & InjectFace<
    Pick<CreatorViewFace, "ready" | "getSettings" | "getCapabilities" | "installCapability" | "checkPlatformLogins" | "openPlatformLogin" | "setLibraryRoot" | "setProfile" | "setScriptRules" | "pickDirectory">
    & { credentials: CredentialsClient | undefined }
  >;

const EMPTY_SECRETS: CreatorSecrets = {
  subtitle: { kind: "subtitle", ref: SUBTITLE_KEY_REFS[0], configured: false, writable: true },
  cover: { kind: "cover", ref: COVER_KEY_REFS[0], configured: false, writable: true },
};

const EMPTY_PROFILE: CreatorProfile = { enabledPlatforms: [] };

const CAPABILITY_ROWS: ReadonlyArray<{ id: keyof CreatorCapabilities; label: CreatorKey }> = [
  { id: "library", label: "settings.capability.library" },
  { id: "screenStudio", label: "settings.capability.screenStudio" },
  { id: "subtitleSkill", label: "settings.capability.subtitle" },
  { id: "coverSkill", label: "settings.capability.cover" },
  { id: "editingSkill", label: "settings.capability.editing" },
  { id: "publishSkill", label: "settings.capability.publish" },
  { id: "presentationSkill", label: "settings.capability.presentation" },
  { id: "articleSkill", label: "settings.capability.article" },
  { id: "publishSync", label: "settings.capability.ego" },
];

function capabilityTone(state: CreatorCapabilities[keyof CreatorCapabilities]["state"]): StatusTone {
  return state === "ready" ? "success" : "neutral";
}

function capabilityStateKey(state: CreatorCapabilities[keyof CreatorCapabilities]["state"]): CreatorKey {
  if (state === "ready") return "settings.state.ready";
  if (state === "unsupported") return "settings.state.unsupported";
  return "settings.state.missing";
}

function cloneProfile(profile: CreatorProfile): CreatorProfile {
  return { enabledPlatforms: [...profile.enabledPlatforms] };
}

function sameProfile(left: CreatorProfile, right: CreatorProfile): boolean {
  return left.enabledPlatforms.length === right.enabledPlatforms.length
    && left.enabledPlatforms.every((platform, index) => platform === right.enabledPlatforms[index]);
}

function loginTone(state: CreatorPlatformLogin["state"] | undefined): StatusTone {
  if (state === "authenticated") return "success";
  if (state === "loginRequired" || state === "error") return "error";
  if (state === "unknown") return "pending";
  return "neutral";
}

function loginStateKey(state: CreatorPlatformLogin["state"] | undefined): CreatorKey {
  if (state === "authenticated") return "settings.login.authenticated";
  if (state === "loginRequired") return "settings.login.required";
  if (state === "unknown") return "settings.login.unknown";
  if (state === "error") return "settings.login.error";
  return "settings.login.unchecked";
}

export function CreatorSettingsCard({
  t,
  ready,
  getSettings,
  setLibraryRoot,
  setProfile,
  setScriptRules,
  pickDirectory,
  getCapabilities,
  installCapability,
  checkPlatformLogins,
  openPlatformLogin,
  credentials,
}: CreatorSettingsCardProps) {
  const [open, setOpen] = useState(false);
  const [savedRoot, setSavedRoot] = useState("");
  const [draftRoot, setDraftRoot] = useState("");
  const [savedProfile, setSavedProfile] = useState<CreatorProfile>(EMPTY_PROFILE);
  const [draftProfile, setDraftProfile] = useState<CreatorProfile>(EMPTY_PROFILE);
  const [savedRules, setSavedRules] = useState("");
  const [draftRules, setDraftRules] = useState("");
  const [secrets, setSecrets] = useState<SecretDraft[]>([
    secretDraftOf(EMPTY_SECRETS.subtitle),
    secretDraftOf(EMPTY_SECRETS.cover),
  ]);
  const [loaded, setLoaded] = useState(false);
  const [capabilities, setCapabilities] = useState<CreatorCapabilities | undefined>(undefined);
  const [capabilitiesLoaded, setCapabilitiesLoaded] = useState(false);
  const [saving, setSaving] = useState(false);
  const [failed, setFailed] = useState(false);
  const [saved, setSaved] = useState(false);
  const [keyFailed, setKeyFailed] = useState(false);
  const [capabilityBusy, setCapabilityBusy] = useState<CreatorInstallTarget | "refresh" | undefined>();
  const [capabilityMessage, setCapabilityMessage] = useState("");
  const [capabilityFailed, setCapabilityFailed] = useState(false);
  const [loginRows, setLoginRows] = useState<Partial<Record<PublishPlatform, CreatorPlatformLogin>>>({});
  const [loginBusy, setLoginBusy] = useState<PublishPlatform | "check" | undefined>();
  const [loginMessage, setLoginMessage] = useState("");
  const [loginFailed, setLoginFailed] = useState(false);

  useEffect(() => {
    if (!ready()) return;
    let cancelled = false;
    void getSettings().then((settings) => {
      if (cancelled) return;
      setSavedRoot(settings.libraryRoot);
      setDraftRoot(settings.libraryRoot);
      setSavedProfile(cloneProfile(settings.profile));
      setDraftProfile(cloneProfile(settings.profile));
      setSavedRules(settings.scriptRules ?? "");
      setDraftRules(settings.scriptRules ?? "");
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

  useEffect(() => {
    if (!open || !ready()) return;
    let cancelled = false;
    setCapabilitiesLoaded(false);
    void getCapabilities().then((next) => {
      if (!cancelled) setCapabilities(next);
    }, () => undefined).finally(() => {
      if (!cancelled) setCapabilitiesLoaded(true);
    });
    return () => {
      cancelled = true;
    };
  }, [open, ready, getCapabilities]);

  const dirtyRoot = draftRoot !== savedRoot;
  const dirtyProfile = !sameProfile(draftProfile, savedProfile);
  const dirtyRules = draftRules !== savedRules;
  const dirtyKeys = secrets.some((item) => item.nextValue.trim() !== "");
  const dirty = dirtyRoot || dirtyProfile || dirtyRules || dirtyKeys;
  const title = t("settings.title" as CreatorKey);

  const onPick = async () => {
    const path = await pickDirectory();
    if (path === null) return;
    setDraftRoot(path);
    setSaved(false);
    setFailed(false);
  };

  const patchProfile = (platform: PublishPlatform, enabled: boolean) => {
    setDraftProfile((current) => {
      const enabledPlatforms = enabled
        ? [...current.enabledPlatforms, platform]
        : current.enabledPlatforms.filter((item) => item !== platform);
      return { enabledPlatforms: normalizeEnabledPlatforms(enabledPlatforms) };
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
        setLoginRows({});
      }
      if (dirtyRules) {
        await setScriptRules(draftRules);
        setSavedRules(draftRules);
      }
      try {
        setCapabilities(await getCapabilities());
      } catch {
        setCapabilityFailed(true);
        setCapabilityMessage(t("settings.capability.loadFailed" as CreatorKey));
      }
      setSaved(true);
    } catch {
      setFailed(true);
    } finally {
      setSaving(false);
    }
  };

  const refreshCapabilities = async () => {
    if (capabilityBusy !== undefined) return;
    setCapabilityBusy("refresh");
    setCapabilitiesLoaded(false);
    setCapabilityFailed(false);
    setCapabilityMessage("");
    try {
      setCapabilities(await getCapabilities());
    } catch {
      setCapabilityFailed(true);
    } finally {
      setCapabilitiesLoaded(true);
      setCapabilityBusy(undefined);
    }
  };

  const onInstall = async (target: CreatorInstallTarget) => {
    if (capabilityBusy !== undefined) return;
    if (target === "publisher" && (dirtyProfile || draftProfile.enabledPlatforms.length === 0)) {
      setCapabilityFailed(true);
      setCapabilityMessage(t("settings.install.savePlatformsFirst" as CreatorKey));
      return;
    }
    if (!window.confirm(t("settings.install.confirm" as CreatorKey))) return;
    setCapabilityBusy(target);
    setCapabilityFailed(false);
    setCapabilityMessage("");
    try {
      const result = await installCapability(target);
      setCapabilities(result.capabilities);
      setCapabilityMessage(result.detail);
    } catch (cause) {
      setCapabilityFailed(true);
      setCapabilityMessage(cause instanceof Error ? cause.message : t("settings.install.failed" as CreatorKey));
    } finally {
      setCapabilityBusy(undefined);
    }
  };

  const onCheckLogins = async () => {
    if (loginBusy !== undefined || draftProfile.enabledPlatforms.length === 0) return;
    setLoginBusy("check");
    setLoginFailed(false);
    setLoginMessage("");
    try {
      const result = await checkPlatformLogins(draftProfile.enabledPlatforms);
      setLoginRows(Object.fromEntries(result.platforms.map((item) => [item.platform, item])));
    } catch (cause) {
      setLoginFailed(true);
      setLoginMessage(cause instanceof Error ? cause.message : t("settings.login.checkFailed" as CreatorKey));
    } finally {
      setLoginBusy(undefined);
    }
  };

  const onOpenLogin = async (platform: PublishPlatform) => {
    if (loginBusy !== undefined) return;
    setLoginBusy(platform);
    setLoginFailed(false);
    setLoginMessage("");
    try {
      await openPlatformLogin(platform);
      setLoginMessage(t("settings.login.opened" as CreatorKey));
    } catch (cause) {
      setLoginFailed(true);
      setLoginMessage(cause instanceof Error ? cause.message : t("settings.login.openFailed" as CreatorKey));
    } finally {
      setLoginBusy(undefined);
    }
  };

  return (
    <li data-plugin="jacky-creator" data-surface="settings-card" className={open ? "card open" : "card"}>
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
          <div className="field">
              <span className="fieldLabel">{t("settings.capabilities" as CreatorKey)}</span>
              <span className="fieldHint">{t("settings.capabilitiesHint" as CreatorKey)}</span>
              <div className="sectionActions">
                <ActionButton disabled={capabilityBusy !== undefined} onClick={() => { void refreshCapabilities(); }}>
                  {t((capabilityBusy === "refresh" ? "settings.capability.checking" : "settings.capability.recheck") as CreatorKey)}
                </ActionButton>
              </div>
              {capabilities !== undefined && <div className="capabilityGrid">
                {CAPABILITY_ROWS.map((row) => {
                  const item = capabilities[row.id];
                  const installTarget = item.installTarget;
                  return (
                    <div key={row.id} className="capabilityItem" title={item.detail}>
                      <span className="capabilityCopy">
                        <span className="capabilityName">{t(row.label)}</span>
                        <span className="capabilityDetail">{item.detail}</span>
                      </span>
                      <span className="capabilityActions">
                        <StatusPill tone={capabilityTone(item.state)}>
                          {t(capabilityStateKey(item.state))}
                        </StatusPill>
                        {item.state !== "ready" && installTarget !== undefined && (
                          <ActionButton
                            disabled={capabilityBusy !== undefined || (installTarget === "publisher" && (dirtyProfile || draftProfile.enabledPlatforms.length === 0))}
                            onClick={() => { void onInstall(installTarget); }}
                          >
                            {t((
                              capabilityBusy === installTarget
                                ? "settings.install.installing"
                                : installTarget === "publisher" && item.path !== undefined
                                  ? "settings.install.configure"
                                  : installTarget === "coverBase"
                                    ? "settings.install.coverBase"
                                    : "settings.install.action"
                            ) as CreatorKey)}
                          </ActionButton>
                        )}
                      </span>
                    </div>
                  );
                })}
              </div>}
              {capabilities === undefined && capabilitiesLoaded && capabilityBusy !== "refresh" && (
                <p className="failed inlineMessage" role="status">{t("settings.capability.loadFailed" as CreatorKey)}</p>
              )}
              {capabilityMessage !== "" && (
                <p className={capabilityFailed ? "failed inlineMessage" : "ok inlineMessage"} role="status">
                  {capabilityMessage}
                </p>
              )}
            </div>
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
            <span className="fieldLabel">{t("settings.enabledPlatforms" as CreatorKey)}</span>
            <span className="fieldHint">{t("settings.enabledPlatformsHint" as CreatorKey)}</span>
            <div className="sectionActions">
              <ActionButton
                disabled={loginBusy !== undefined || draftProfile.enabledPlatforms.length === 0}
                onClick={() => { void onCheckLogins(); }}
              >
                {t((loginBusy === "check" ? "settings.login.checking" : "settings.login.check") as CreatorKey)}
              </ActionButton>
            </div>
            {CREATOR_SETTINGS_PLATFORMS.map((platform) => {
              const row = loginRows[platform.key];
              const enabled = draftProfile.enabledPlatforms.includes(platform.key);
              return (
              <div className="platformRow" key={platform.key}>
                <label className="platformChoice">
                  <input
                    type="checkbox"
                    checked={enabled}
                    onChange={(event) => { patchProfile(platform.key, event.target.checked); }}
                  />
                  {t(platform.label)}
                </label>
                {enabled && (
                  <span className="platformActions" title={row?.detail}>
                    <StatusPill tone={loginTone(row?.state)}>{t(loginStateKey(row?.state))}</StatusPill>
                    {(row === undefined || row.state !== "authenticated") && (
                      <ActionButton disabled={loginBusy !== undefined} onClick={() => { void onOpenLogin(platform.key); }}>
                        {t((loginBusy === platform.key ? "settings.login.opening" : "settings.login.open") as CreatorKey)}
                      </ActionButton>
                    )}
                  </span>
                )}
              </div>
              );
            })}
            {loginMessage !== "" && (
              <p className={loginFailed ? "failed inlineMessage" : "ok inlineMessage"} role="status">{loginMessage}</p>
            )}
          </div>
          <div className="field">
            <span className="fieldLabel">{t("settings.scriptRules" as CreatorKey)}</span>
            <span className="fieldHint">{t("settings.scriptRulesHint" as CreatorKey)}</span>
            <textarea
              className="input textarea"
              rows={6}
              placeholder={t("settings.scriptRulesPlaceholder" as CreatorKey)}
              value={draftRules}
              onChange={(event) => {
                setDraftRules(event.target.value);
                setSaved(false);
                setFailed(false);
              }}
            />
          </div>
          <div className="field">
            <span className="fieldLabel">{t("settings.secrets" as CreatorKey)}</span>
            <span className="fieldHint">{t("settings.secretsHint" as CreatorKey)}</span>
            {secrets.map((item) => (
              <label className="inputLabel" key={item.kind}>
                <span className="secretHead">
                  <span>{t(`settings.secret.${item.kind}` as CreatorKey)}</span>
                  <StatusPill tone={item.loadError ? "error" : item.configured ? "success" : "neutral"}>
                    {t((
                      item.loadError
                        ? "settings.secret.loadFailed"
                        : item.configured
                          ? "settings.secret.configured"
                          : "settings.secret.missing"
                    ) as CreatorKey)}
                  </StatusPill>
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
                  setDraftRules(savedRules);
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
