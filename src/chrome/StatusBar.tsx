import {
  ChevronRight,
  Command,
  FolderGit2,
  GitBranch,
  Sparkles,
} from "lucide-react";
import { useI18n } from "../i18n/i18n";
import { useUpdates } from "../updates/updates";

export function StatusBar({
  demo,
  path,
  repository,
  branch,
  onShortcuts,
  onUpdate,
}: {
  demo: boolean;
  path: string;
  repository: string;
  branch: string;
  onShortcuts: () => void;
  onUpdate: () => void;
}) {
  const { t } = useI18n();
  const { state } = useUpdates();
  return (
    <footer className="statusbar">
      <span>
        <FolderGit2 size={12} /> {repository} <ChevronRight size={11} />{" "}
        <GitBranch size={12} />
        {branch}
      </span>
      <span>
        {state.status === "available" && (
          <>
            <button className="update-pill" onClick={onUpdate}>
              <Sparkles size={12} />
              {t("updates.available", { version: state.update.version })}
            </button>
            <span className="footer-divider">|</span>
          </>
        )}
        <span className="status-dot" />
        {demo ? t("statusbar.demo") : path}
        <span className="footer-divider">|</span>
        <button onClick={onShortcuts}>
          <Command size={12} /> {t("statusbar.shortcuts")}
        </button>
      </span>
    </footer>
  );
}
