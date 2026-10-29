import type { ReactNode } from "react";
import { Monitor, Moon, Sun, X } from "lucide-react";
import type { Preferences } from "../App";
import { useI18n, type Key } from "../i18n/i18n";
import { useUpdates } from "../updates/updates";

function Dialog({
  eyebrow,
  title,
  onClose,
  children,
}: {
  eyebrow: string;
  title: string;
  onClose: () => void;
  children: ReactNode;
}) {
  const { t } = useI18n();
  return (
    <div className="modal-overlay" onClick={onClose}>
      <section
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onClick={(e) => e.stopPropagation()}
      >
        <button
          className="modal-close icon-button"
          aria-label={t("dialog.close")}
          onClick={onClose}
        >
          <X />
        </button>
        <div className="eyebrow">{eyebrow}</div>
        <h2>{title}</h2>
        {children}
      </section>
    </div>
  );
}

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

export function SettingsDialog({
  preferences,
  onClose,
}: {
  preferences: Preferences;
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
      <VersionLine />
    </Dialog>
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
