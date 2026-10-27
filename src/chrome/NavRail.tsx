import {
  FolderGit2,
  GitBranch,
  History,
  Moon,
  Settings,
  Sun,
} from "lucide-react";
import { useI18n, type Key } from "../i18n/i18n";
import { DrawIcon } from "../ui/DrawIcon";
import { initials } from "../ui/hooks";

export type Mode = "Changes" | "History" | "Branches";

const items: {
  mode: Mode;
  icon: typeof History;
  label: Key;
  advanced?: true;
}[] = [
  { mode: "Changes", icon: FolderGit2, label: "nav.changes" },
  { mode: "History", icon: History, label: "nav.history" },
  { mode: "Branches", icon: GitBranch, label: "nav.branches", advanced: true },
];

export function NavRail({
  mode,
  onMode,
  hasChanges,
  dark,
  onToggleTheme,
  onSettings,
  user,
}: {
  mode: Mode;
  onMode: (mode: Mode) => void;
  hasChanges: boolean;
  dark: boolean;
  onToggleTheme: () => void;
  onSettings: () => void;
  user: string;
}) {
  const { t, mode: uiMode } = useI18n();
  return (
    <nav className="nav-rail">
      <div>
        {items
          .filter((item) => !item.advanced || uiMode === "full")
          .map(({ mode: m, icon, label }) => (
            <button
              key={m}
              title={t(label)}
              aria-label={t(label)}
              aria-current={mode === m ? "page" : undefined}
              className={mode === m ? "nav-item active" : "nav-item"}
              onClick={() => onMode(m)}
            >
              <DrawIcon icon={icon} active={mode === m} size={21} />
              {m === "Changes" && hasChanges && <i />}
            </button>
          ))}
      </div>
      <div>
        <button
          className="nav-item"
          title={t(dark ? "nav.lightTheme" : "nav.darkTheme")}
          aria-label={t("nav.toggleTheme")}
          onClick={onToggleTheme}
        >
          {dark ? <Sun /> : <Moon />}
        </button>
        <button
          className="nav-item"
          title={t("nav.settings")}
          aria-label={t("nav.settings")}
          onClick={onSettings}
        >
          <Settings size={21} />
        </button>
        <span className="avatar" title={user}>
          {initials(user)}
        </span>
      </div>
    </nav>
  );
}
