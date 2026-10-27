import { useEffect, useRef, useState } from "react";
import {
  ArrowDown,
  ArrowUp,
  Check,
  ChevronDown,
  FolderGit2,
  GitBranch,
  GitPullRequest,
  Plus,
  RefreshCw,
  X,
} from "lucide-react";
import type { RepoSnapshot } from "../git/types";
import { setupModes, type Repository, type SetupMode } from "../repositories";
import { setupModeMeta } from "../setup/modes";
import { timeAgo, useDismiss } from "../ui/hooks";

/** Re-renders every minute so relative times stay fresh. */
function useMinuteTick() {
  const [, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 60_000);
    return () => clearInterval(id);
  }, []);
}

function syncSummary({
  ahead,
  behind,
  upstream,
  lastFetched,
}: RepoSnapshot["sync"]) {
  if (!upstream) return "This branch is not published yet.";
  const parts = [
    behind ? `${behind} incoming from ${upstream}` : "",
    ahead ? `${ahead} ready to push` : "",
  ].filter(Boolean);
  const checked = lastFetched
    ? `Checked ${timeAgo(lastFetched)}.`
    : "Not checked yet.";
  return `${checked} ${parts.length ? parts.join(", ") + "." : "You're up to date."} Click to check again.`;
}

export function TopBar({
  snapshot,
  repository,
  repositories,
  working,
  pullRequests,
  onFetch,
  onBranches,
  onSwitchRepository,
  onRemoveRepository,
  onSetup,
  onPull,
  onPush,
  onNewBranch,
  onPullRequests,
}: {
  snapshot: RepoSnapshot;
  repository: Repository;
  repositories: Repository[];
  /** A long-running operation in progress, e.g. "Pull…". */
  working: string | null;
  /** Open pull requests, or null when no hosting service is connected. */
  pullRequests: number | null;
  onFetch: () => void;
  onBranches: () => void;
  onSwitchRepository: (id: string) => void;
  onRemoveRepository: (id: string) => void;
  onSetup: (mode: SetupMode) => void;
  onPull: () => void;
  onPush: () => void;
  onNewBranch: () => void;
  onPullRequests: () => void;
}) {
  useMinuteTick();
  const [menu, setMenu] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  useDismiss(menuRef, menu, () => setMenu(false));
  const { sync, branches } = snapshot;
  return (
    <header className="topbar">
      <div className="brand">
        <span className="brand-mark">r</span>
        <span>
          rivet<span className="brand-dot">.</span>
        </span>
      </div>
      <div className="branch-fetch-group">
        <button
          className="branch-selector"
          title={`Current branch: ${branches.current}`}
          onClick={onBranches}
        >
          <GitBranch />
          <span>{branches.current}</span>
          <ChevronDown size={13} />
        </button>
        <button
          className="fetch-control"
          title={syncSummary(sync)}
          aria-label="Check the remote for new commits"
          disabled={!!working || !sync.upstream}
          onClick={onFetch}
        >
          <RefreshCw className={working ? "spinning" : ""} />
          <span>
            {working
              ? working
              : !sync.upstream
                ? "No remote"
                : sync.lastFetched
                  ? timeAgo(sync.lastFetched)
                  : "Never checked"}
          </span>
        </button>
      </div>
      <div className="repo-wrap" ref={menuRef}>
        <button
          className="repo-selector"
          aria-expanded={menu}
          onClick={() => setMenu(!menu)}
        >
          <FolderGit2 />
          {repository.name}
          <ChevronDown size={13} />
        </button>
        {menu && (
          <div className="dropdown repository-menu">
            <small>YOUR REPOSITORIES</small>
            <div className="repository-list">
              {repositories.map((r) => (
                <div className="repository-item" key={r.id}>
                  <button
                    onClick={() => {
                      setMenu(false);
                      onSwitchRepository(r.id);
                    }}
                  >
                    <FolderGit2 />
                    <span>
                      <strong>{r.name}</strong>
                      <small>{r.path}</small>
                    </span>
                    {repository.id === r.id && <Check />}
                  </button>
                  <button
                    className="icon-button repository-remove"
                    title={`Remove ${r.name} from the list (files stay on disk)`}
                    aria-label={`Remove ${r.name} from the list`}
                    onClick={() => onRemoveRepository(r.id)}
                  >
                    <X />
                  </button>
                </div>
              ))}
            </div>
            <div className="repository-menu-actions">
              {setupModes.map((mode) => {
                const { menu: label, Icon } = setupModeMeta[mode];
                return (
                  <button
                    key={mode}
                    onClick={() => {
                      setMenu(false);
                      onSetup(mode);
                    }}
                  >
                    <Icon />
                    {label}
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>
      <div className="top-actions">
        {pullRequests !== null && (
          <button
            className="text-button pr-trigger"
            onClick={onPullRequests}
            title="Browse open pull requests"
          >
            <GitPullRequest />
            <span>Pull requests</span>
            <span className="count">{pullRequests}</span>
          </button>
        )}
        <button
          className="button"
          disabled={!sync.behind || !!working}
          onClick={onPull}
          title={
            sync.behind
              ? `Bring ${sync.behind} commits from ${sync.upstream} into ${branches.current}`
              : "Nothing to pull"
          }
        >
          <ArrowDown />
          Pull{sync.behind ? ` ${sync.behind}` : ""}
        </button>
        <button
          className="button push"
          disabled={!sync.ahead || !sync.upstream || !!working}
          onClick={onPush}
          title={
            sync.ahead
              ? `Publish ${sync.ahead} commits to ${sync.upstream}`
              : "Nothing to push"
          }
        >
          <ArrowUp />
          Push{sync.ahead ? ` ${sync.ahead}` : ""}
        </button>
        <span className="separator" />
        <button
          className="icon-button"
          title="New branch"
          aria-label="New branch"
          onClick={onNewBranch}
        >
          <Plus />
        </button>
      </div>
    </header>
  );
}
