import type { ReactNode } from "react";
import { Monitor, Moon, Sun, X } from "lucide-react";
import type { ThemePreference } from "../App";

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
          aria-label="Close dialog"
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

const themes = [
  { value: "light", label: "Light", Icon: Sun },
  { value: "dark", label: "Dark", Icon: Moon },
  { value: "system", label: "System", Icon: Monitor },
] as const;

export function SettingsDialog({
  theme,
  setTheme,
  onClose,
}: {
  theme: ThemePreference;
  setTheme: (theme: ThemePreference) => void;
  onClose: () => void;
}) {
  return (
    <Dialog
      eyebrow="PERSONALIZE YOUR WORKSPACE"
      title="Settings"
      onClose={onClose}
    >
      <p>Choose the appearance that works for you.</p>
      <div className="theme-options">
        {themes.map(({ value, label, Icon }) => (
          <button
            key={value}
            className={`button ${theme === value ? "primary" : ""}`}
            onClick={() => setTheme(value)}
          >
            <Icon />
            {label}
          </button>
        ))}
      </div>
      <p className="muted">Rivet 0.1 · Interactive UI prototype</p>
    </Dialog>
  );
}

const shortcuts = [
  ["Ctrl + Enter", "Commit from the message fields"],
  ["Esc", "Close a dialog or menu"],
  ["← →", "Resize the focused divider"],
  ["Tab / Enter / Space", "Move between and use controls"],
];

export function ShortcutsDialog({ onClose }: { onClose: () => void }) {
  return (
    <Dialog eyebrow="QUICK REFERENCE" title="Shortcuts" onClose={onClose}>
      <dl className="shortcut-list">
        {shortcuts.map(([keys, action]) => (
          <div key={keys}>
            <dt>
              <kbd>{keys}</kbd>
            </dt>
            <dd>{action}</dd>
          </div>
        ))}
      </dl>
    </Dialog>
  );
}
