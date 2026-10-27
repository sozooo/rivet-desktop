import { ChevronRight, Command, FolderGit2, GitBranch } from "lucide-react";

export function StatusBar({
  repository,
  branch,
  onShortcuts,
}: {
  repository: string;
  branch: string;
  onShortcuts: () => void;
}) {
  return (
    <footer className="statusbar">
      <span>
        <FolderGit2 size={12} /> {repository} <ChevronRight size={11} />{" "}
        <GitBranch size={12} />
        {branch}
      </span>
      <span>
        <span className="status-dot" /> Demo data · nothing is written to disk
        <span className="footer-divider">|</span>
        <button onClick={onShortcuts}>
          <Command size={12} /> Shortcuts
        </button>
      </span>
    </footer>
  );
}
