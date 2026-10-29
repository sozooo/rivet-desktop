import { Copy, Github, LogOut, Monitor, Moon, Sun } from "lucide-react";
import type { Preferences } from "../App";
import { copyReport } from "../errors/log";
import { useAccount } from "../github/account";
import { useI18n, type Key } from "../i18n/i18n";
import { useIdentity } from "../onboarding/identity";
import type { RepoApi } from "../views/repoApi";
import { ProjectSettings } from "./ProjectSettings";
import { useUpdates } from "../updates/updates";
import { Dialog } from "../ui/Dialog";
import { Avatar } from "../ui/Avatar";
import { useNotify } from "../ui/Toast";

function Choice<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: { value: T; label: string; Icon?: typeof Sun }[];
  onChange: (value: T) => void;
}) {
  return (
    <div className="setting">
      <span className="setting-label">{label}</span>
      <div className="theme-options" role="radiogroup" aria-label={label}>
        {options.map((option) => (
          <button
            key={option.value}
            role="radio"
            aria-checked={value === option.value}
            className={`button ${value === option.value ? "primary" : ""}`}
            onClick={() => onChange(option.value)}
          >
            {option.Icon && <option.Icon />}
            {option.label}
          </button>
        ))}
      </div>
    </div>
  );
}

/** The GitHub account: who is signed in, with sign-in and sign-out. */
function AccountSetting() {
  const { t, mode } = useI18n();
  const { available, user, signIn, signOut } = useAccount();
  if (!available)
    return mode === "full" ? (
      <div className="setting">
        <span className="setting-label">{t("settings.account")}</span>
        <p className="setting-hint">{t("github.notConfigured")}</p>
      </div>
    ) : null;
  return (
    <div className="setting">
      <span className="setting-label">{t("settings.account")}</span>
      <div className="account">
        {user ? (
          <Avatar name={user.name ?? user.login} url={user.avatarUrl} />
        ) : (
          <span className="avatar">
            <Github />
          </span>
        )}
        <span className="account-name">
          <strong>
            {user === undefined
              ? t("github.checking")
              : user
                ? (user.name ?? user.login)
                : t("github.notSignedIn")}
          </strong>
          <small>{user ? `@${user.login}` : t("github.signInHint")}</small>
        </span>
        {user ? (
          <button
            className="button"
            title={t("github.signOutHint")}
            onClick={signOut}
          >
            <LogOut />
            {t("github.signOut")}
          </button>
        ) : (
          user === null && (
            <button className="button primary" onClick={signIn}>
              <Github />
              {t("github.signIn")}
            </button>
          )
        )}
      </div>
    </div>
  );
}

export function SettingsDialog({
  preferences,
  repo,
  onClose,
}: {
  preferences: Preferences;
  /** The open repository, for its own settings. */
  repo?: RepoApi;
  onClose: () => void;
}) {
  const { t } = useI18n();
  const { theme, setTheme, language, setLanguage, mode, setMode } = preferences;
  return (
    <Dialog
      eyebrow={t("settings.eyebrow")}
      title={t("settings.title")}
      onClose={onClose}
    >
      <AccountSetting />
      <Choice
        label={t("settings.mode")}
        value={mode}
        onChange={setMode}
        options={[
          { value: "simple", label: t("settings.simple") },
          { value: "full", label: t("settings.full") },
        ]}
      />
      <p className="setting-hint">
        {t(mode === "simple" ? "settings.simpleHint" : "settings.fullHint")}
      </p>
      <Choice
        label={t("settings.language")}
        value={language}
        onChange={setLanguage}
        options={[
          { value: "ru", label: "Русский" },
          { value: "en", label: "English" },
        ]}
      />
      <Choice
        label={t("settings.appearance")}
        value={theme}
        onChange={setTheme}
        options={[
          { value: "light", label: t("settings.light"), Icon: Sun },
          { value: "dark", label: t("settings.dark"), Icon: Moon },
          { value: "system", label: t("settings.system"), Icon: Monitor },
        ]}
      />
      <IdentitySetting />
      {repo && <ProjectSettings repo={repo} />}
      <HelpSetting />
      <VersionLine />
    </Dialog>
  );
}

/** The name and email commits are signed with, and a way to change them. */
function IdentitySetting() {
  const { t } = useI18n();
  const { identity, ask } = useIdentity();
  if (identity === undefined) return null;
  return (
    <div className="setting">
      <span className="setting-label">{t("settings.identity")}</span>
      <div className="identity-row">
        <span>
          {identity ? (
            <>
              <strong>{identity.name}</strong> <small>{identity.email}</small>
            </>
          ) : (
            t("settings.identityNone")
          )}
        </span>
        <button className="text-button" onClick={ask}>
          {t("settings.identityEdit")}
        </button>
      </div>
    </div>
  );
}

/** The error report to send the developer when something doesn't work. */
function HelpSetting() {
  const { t, language, mode } = useI18n();
  const notify = useNotify();
  const copy = () =>
    copyReport(`UI: ${language}, ${mode}`).then(
      () => notify(t("settings.reportCopied")),
      () => notify(t("common.clipboardUnavailable"), "error"),
    );
  return (
    <div className="setting">
      <span className="setting-label">{t("settings.help")}</span>
      <div className="row">
        <button className="button" onClick={copy}>
          <Copy />
          {t("settings.report")}
        </button>
      </div>
      <p className="setting-hint">{t("settings.reportHint")}</p>
    </div>
  );
}

/** The installed version and, in the desktop app, a way to look for a newer one. */
function VersionLine() {
  const { t } = useI18n();
  const { state, version, check } = useUpdates();
  const status =
    state.status === "checking"
      ? t("settings.checking")
      : state.status === "latest"
        ? t("settings.upToDate")
        : state.status === "unpublished"
          ? t("settings.unpublished")
          : state.status === "available"
            ? t("settings.updateAvailable", { version: state.update.version })
            : state.status === "error"
              ? t("settings.updateError")
              : "";
  return (
    <div className="version-line">
      <span className="muted">{t("settings.version", { version })}</span>
      {state.status !== "unavailable" && (
        <>
          <button
            className="text-button"
            disabled={state.status === "checking"}
            onClick={check}
          >
            {t("settings.checkUpdates")}
          </button>
          {status && <span className="muted">{status}</span>}
        </>
      )}
    </div>
  );
}

const shortcuts: [string, Key][] = [
  ["Ctrl + Enter", "shortcuts.commit"],
  ["Esc", "shortcuts.escape"],
  ["← →", "shortcuts.resize"],
  ["Tab / Enter / Space", "shortcuts.tab"],
];

export function ShortcutsDialog({ onClose }: { onClose: () => void }) {
  const { t } = useI18n();
  return (
    <Dialog
      eyebrow={t("shortcuts.eyebrow")}
      title={t("shortcuts.title")}
      onClose={onClose}
    >
      <dl className="shortcut-list">
        {shortcuts.map(([keys, action]) => (
          <div key={keys}>
            <dt>
              <kbd>{keys}</kbd>
            </dt>
            <dd>{t(action)}</dd>
          </div>
        ))}
      </dl>
    </Dialog>
  );
}
