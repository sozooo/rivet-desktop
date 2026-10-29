import { useEffect, useRef, useState } from "react";
import {
  ArrowDown,
  ArrowUp,
  Check,
  ChevronDown,
  CloudUpload,
  FolderGit2,
  GitPullRequest,
  Laptop,
  Plus,
  RefreshCw,
  X,
} from "lucide-react";
import { unresolved } from "../git/conflicts";
import type { RepoSnapshot } from "../git/types";
import { useI18n } from "../i18n/i18n";
import { setupModes, type Repository, type SetupMode } from "../repositories";
import { setupModeMeta } from "../setup/modes";
import { useDismiss } from "../ui/hooks";
import { BranchMenu } from "./BranchMenu";

/** Re-renders every minute so relative times stay fresh. */
function useMinuteTick() {
  const [, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 60_000);
    return () => clearInterval(id);
  }, []);
}

export function TopBar({
  snapshot,
  repository,
  repositories,
  working,
  pullRequests,
  onFetch,
  onSync,
  onBranches,
  onSwitchBranch,
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
  /** Simple mode's one button: fetch, pull and push as needed. */
  onSync: () => void;
  onBranches: () => void;
  onSwitchBranch: (target: string) => void;
  onSwitchRepository: (id: string) => void;
  onRemoveRepository: (id: string) => void;
  onSetup: (mode: SetupMode) => void;
  onPull: () => void;
  onPush: () => void;
  onNewBranch: () => void;
  onPullRequests: () => void;
}) {
  useMinuteTick();
  const { t, mode, timeAgo } = useI18n();
  const [menu, setMenu] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  useDismiss(menuRef, menu, () => setMenu(false));
  const { sync, branches } = snapshot;
  const simple = mode === "simple";
  const hasRemote = !!sync.upstream || branches.remote.length > 0;
  // Nothing goes in or out until a stopped merge is finished or cancelled.
  const merging = !!snapshot.operation || unresolved(snapshot.files).length > 0;

  function syncSummary() {
    if (!sync.upstream) return t("top.sync.unpublished");
    const parts = [
      sync.behind
        ? t("top.sync.incoming", {
            count: sync.behind,
            upstream: sync.upstream,
          })
        : "",
      sync.ahead ? t("top.sync.toPush", { count: sync.ahead }) : "",
    ].filter(Boolean);
    const checked = sync.lastFetched
      ? t("top.sync.checked", { time: timeAgo(sync.lastFetched) })
      : t("top.sync.notChecked");
    return `${checked} ${parts.length ? parts.join(", ") + "." : t("top.sync.upToDate")} ${t("top.sync.clickToCheck")}`;
  }

  const pending = !!(
    sync.behind ||
    sync.ahead ||
    (hasRemote && !sync.upstream)
  );
  const [StatusIcon, status] = !hasRemote
    ? [Laptop, t("top.status.local")]
    : !sync.upstream
      ? [CloudUpload, t("top.status.unpublished")]
      : pending
        ? [
            sync.behind ? ArrowDown : ArrowUp,
            [
              sync.behind
                ? t("top.status.incoming", { count: sync.behind })
                : "",
              sync.ahead
                ? t("top.status.toPublish", { count: sync.ahead })
                : "",
            ]
              .filter(Boolean)
              .join(" · "),
          ]
        : [Check, t("top.status.upToDate")];

  return (
    <header className="topbar">
      <div className="brand">
        <span className="brand-mark">r</span>
        <span>
          rivet<span className="brand-dot">.</span>
        </span>
      </div>
      <div className="branch-sync">
        <div className="branch-fetch-group">
          <BranchMenu
            branches={branches}
            blocked={
              merging ? t("top.syncMerging") : working ? t("top.busy") : null
            }
            onSwitch={onSwitchBranch}
            onNewBranch={onNewBranch}
            onAllBranches={onBranches}
          />
          <button
            className="fetch-control"
            title={syncSummary()}
            aria-label={t("top.checkRemote")}
            disabled={!!working || !sync.upstream}
            onClick={onFetch}
          >
            <RefreshCw className={working ? "spinning" : ""} />
            <span>
              {working
                ? working
                : !sync.upstream
                  ? t("top.noRemote")
                  : sync.lastFetched
                    ? timeAgo(sync.lastFetched)
                    : t("top.neverChecked")}
            </span>
          </button>
        </div>
        <span
          className={`sync-status ${pending ? "pending" : ""}`}
          aria-live="polite"
        >
          <StatusIcon />
          {status}
        </span>
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
            <small>{t("top.repositories")}</small>
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
                    title={t("top.removeRepository", { name: r.name })}
                    aria-label={t("top.removeRepositoryLabel", {
                      name: r.name,
                    })}
                    onClick={() => onRemoveRepository(r.id)}
                  >
                    <X />
                  </button>
                </div>
              ))}
            </div>
            <div className="repository-menu-actions">
              {setupModes.map((setupMode) => {
                const { menu: label, Icon } = setupModeMeta[setupMode];
                return (
                  <button
                    key={setupMode}
                    onClick={() => {
                      setMenu(false);
                      onSetup(setupMode);
                    }}
                  >
                    <Icon />
                    {t(label)}
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>
      <div className="top-actions">
        {simple ? (
          <button
            className="button primary sync-button"
            disabled={!!working || !hasRemote || merging}
            title={t(merging ? "top.syncMerging" : "top.syncTitle")}
            onClick={onSync}
          >
            <RefreshCw className={working ? "spinning" : ""} />
            {working ?? t("top.sync")}
          </button>
        ) : (
          <>
            {pullRequests !== null && (
              <button
                className="text-button pr-trigger"
                onClick={onPullRequests}
                title={t("top.pullRequestsTitle")}
              >
                <GitPullRequest />
                <span>{t("top.pullRequests")}</span>
                <span className="count">{pullRequests}</span>
              </button>
            )}
            <button
              className="button"
              disabled={!sync.behind || !!working || merging}
              onClick={onPull}
              title={
                merging
                  ? t("top.syncMerging")
                  : sync.behind
                    ? t("top.pullTitle", {
                        count: sync.behind,
                        upstream: sync.upstream ?? "",
                        branch: branches.current,
                      })
                    : t("top.nothingToPull")
              }
            >
              <ArrowDown />
              {t("top.pull")}
              {sync.behind ? ` ${sync.behind}` : ""}
            </button>
            <button
              className="button push"
              disabled={!sync.ahead || !sync.upstream || !!working || merging}
              onClick={onPush}
              title={
                merging
                  ? t("top.syncMerging")
                  : sync.ahead
                    ? t("top.pushTitle", {
                        count: sync.ahead,
                        upstream: sync.upstream ?? "",
                      })
                    : t("top.nothingToPush")
              }
            >
              <ArrowUp />
              {t("top.push")}
              {sync.ahead ? ` ${sync.ahead}` : ""}
            </button>
            <span className="separator" />
            <button
              className="icon-button"
              title={t("top.newBranch")}
              aria-label={t("top.newBranch")}
              onClick={onNewBranch}
            >
              <Plus />
            </button>
          </>
        )}
      </div>
    </header>
  );
}
