import {
  FolderGit2,
  GitBranch,
  History,
  Moon,
  Settings,
  Sun,
} from "lucide-react";
import { DrawIcon } from "../ui/DrawIcon";
import { initials } from "../ui/hooks";

export type Mode = "Changes" | "History" | "Branches";

const items = [
  { mode: "Changes", icon: FolderGit2 },
  { mode: "History", icon: History },
  { mode: "Branches", icon: GitBranch },
] as const;

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
  return (
    <nav className="nav-rail">
      <div>
        {items.map(({ mode: m, icon }) => (
          <button
            key={m}
            title={m}
            aria-label={m}
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
          title={dark ? "Light theme" : "Dark theme"}
          aria-label="Toggle theme"
          onClick={onToggleTheme}
        >
          {dark ? <Sun /> : <Moon />}
        </button>
        <button
          className="nav-item"
          title="Settings"
          aria-label="Settings"
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
