import { useCallback, useEffect, useState, type CSSProperties } from "react";
import { AlertTriangle } from "lucide-react";
import { NavRail, type Mode } from "./chrome/NavRail";
import { StatusBar } from "./chrome/StatusBar";
import { TopBar } from "./chrome/TopBar";
import { SettingsDialog, ShortcutsDialog } from "./dialogs/InfoDialogs";
import { OperationDialog } from "./dialogs/OperationDialog";
import {
  operations,
  type OpContext,
  type OperationId,
} from "./dialogs/operations";
import { PullRequests, openPullRequests } from "./dialogs/PullRequests";
import type { GitBackend } from "./git/backend";
import type { RepoSnapshot } from "./git/types";
import type { Repository, SetupMode } from "./repositories";
import { RepositorySetup } from "./setup/RepositorySetup";
import type { ThemePreference } from "./App";
import { platform } from "./platform";
import { useStoredState } from "./ui/hooks";
import { SidebarContext } from "./ui/Panes";
import { useNotify } from "./ui/Toast";
import { useFadeSwitch } from "./ui/useFadeSwitch";
import { BranchesView } from "./views/branches/BranchesView";
import { ChangesView } from "./views/changes/ChangesView";
import { HistoryView } from "./views/history/HistoryView";
import type { RepoApi } from "./views/repoApi";

type Dialog =
  | { kind: "operation"; id: OperationId; context: OpContext }
  | { kind: "settings" | "shortcuts" | "pull-requests" };

export function Workspace({
  repository,
  repositories,
  backend,
  dark,
  theme,
  setTheme,
  onSwitchRepository,
  onAddRepository,
  onRemoveRepository,
}: {
  repository: Repository;
  repositories: Repository[];
  backend: GitBackend;
  dark: boolean;
  theme: ThemePreference;
  setTheme: (theme: ThemePreference) => void;
  onSwitchRepository: (id: string) => void;
  onAddRepository: (repository: Repository) => void;
  onRemoveRepository: (id: string) => void;
}) {
  const notify = useNotify();
  const [snapshot, setSnapshot] = useState<RepoSnapshot>();
  const [mode, setMode, phase] = useFadeSwitch<Mode>("Changes");
  const [setup, setSetup] = useState<SetupMode | null>(null);
  const [dialog, setDialog] = useState<Dialog | null>(null);
  const [loadError, setLoadError] = useState<string>();
  /** What a long-running git operation is doing, shown in the top bar. */
  const [working, setWorking] = useState<string | null>(null);
  const [sidebarOpen, setSidebarOpen] = useStoredState(
    "rivet.sidebar.open",
    true,
  );
  const [sidebarWidth, setSidebarWidth] = useStoredState(
    "rivet.sidebar.width",
    310,
  );

  const refresh = useCallback(async () => {
    try {
      const next = await backend.snapshot();
      setSnapshot(next);
      setLoadError(undefined);
      return next;
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : String(error));
      return null;
    }
  }, [backend]);
  useEffect(() => {
    refresh();
    // Files change in Unity or a text editor while Rivet is in the background.
    window.addEventListener("focus", refresh);
    return () => window.removeEventListener("focus", refresh);
  }, [refresh]);

  const act = useCallback<RepoApi["act"]>(
    async (action, success) => {
      try {
        await action(backend);
        if (success) notify(success);
        return await refresh();
      } catch (error) {
        notify(error instanceof Error ? error.message : String(error), "error");
        await refresh();
        return null;
      }
    },
    [backend, notify, refresh],
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      setDialog(null);
      setSetup(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  if (!snapshot)
    return loadError ? (
      <div className="load-error">
        <AlertTriangle />
        <h2>Couldn't open {repository.name}</h2>
        <code>{repository.path}</code>
        <p>{loadError}</p>
        <div className="row">
          <button className="button primary" onClick={refresh}>
            Try again
          </button>
          <button
            className="button"
            onClick={() => onRemoveRepository(repository.id)}
          >
            Remove from the list
          </button>
        </div>
      </div>
    ) : null;

  const openOperation = (id: OperationId, context: Partial<OpContext> = {}) =>
    setDialog({
      kind: "operation",
      id,
      context: {
        branch: snapshot.branches.current,
        branches: snapshot.branches.local,
        sync: snapshot.sync,
        ...context,
      },
    });
  const demo = !platform.desktop || repository.kind === "demo";
  const repo: RepoApi = {
    repository,
    demo,
    snapshot,
    backend,
    act,
    openOperation,
  };

  async function fetchRemote() {
    setWorking("Checking…");
    const next = await act((b) => b.fetch());
    setWorking(null);
    if (next)
      notify(
        next.sync.behind
          ? `${next.sync.behind} new commits on ${next.sync.upstream}. Pull to bring them in.`
          : "Checked the remote. Nothing new.",
      );
  }

  return (
    <>
      <TopBar
        snapshot={snapshot}
        repository={repository}
        repositories={repositories}
        working={working}
        pullRequests={demo ? openPullRequests : null}
        onFetch={fetchRemote}
        onBranches={() => setMode("Branches")}
        onSwitchRepository={onSwitchRepository}
        onRemoveRepository={onRemoveRepository}
        onSetup={setSetup}
        onPull={() => openOperation("pull")}
        onPush={() => openOperation("push")}
        onNewBranch={() => openOperation("new-branch")}
        onPullRequests={() => setDialog({ kind: "pull-requests" })}
      />
      <div
        className="shell"
        style={{ "--sidebar-width": `${sidebarWidth}px` } as CSSProperties}
      >
        <NavRail
          mode={mode}
          onMode={setMode}
          hasChanges={snapshot.files.length > 0}
          dark={dark}
          onToggleTheme={() => setTheme(dark ? "light" : "dark")}
          onSettings={() => setDialog({ kind: "settings" })}
          user={snapshot.user.name}
        />
        <SidebarContext.Provider
          value={{
            open: sidebarOpen,
            setOpen: setSidebarOpen,
            width: sidebarWidth,
            setWidth: setSidebarWidth,
          }}
        >
          {mode === "Changes" ? (
            <ChangesView repo={repo} phase={phase} />
          ) : mode === "History" ? (
            <HistoryView repo={repo} phase={phase} />
          ) : (
            <BranchesView
              repo={repo}
              phase={phase}
              onHistory={() => setMode("History")}
            />
          )}
        </SidebarContext.Provider>
      </div>
      <StatusBar
        demo={demo}
        path={repository.path}
        repository={repository.name}
        branch={snapshot.branches.current}
        onShortcuts={() => setDialog({ kind: "shortcuts" })}
      />
      {setup && (
        <RepositorySetup
          initialMode={setup}
          repositories={repositories}
          onCancel={() => setSetup(null)}
          onComplete={(r) => {
            setSetup(null);
            onAddRepository(r);
          }}
        />
      )}
      {dialog?.kind === "operation" && (
        <OperationDialog
          key={dialog.id}
          id={dialog.id}
          context={dialog.context}
          demo={demo}
          onClose={() => setDialog(null)}
          onRun={async (input) => {
            const op = operations[dialog.id];
            setDialog(null);
            setWorking(`${op.title}…`);
            await act(
              (b) => op.run!(b, dialog.context, input),
              op.done?.(dialog.context, input),
            );
            setWorking(null);
          }}
        />
      )}
      {dialog?.kind === "settings" && (
        <SettingsDialog
          theme={theme}
          setTheme={setTheme}
          onClose={() => setDialog(null)}
        />
      )}
      {dialog?.kind === "shortcuts" && (
        <ShortcutsDialog onClose={() => setDialog(null)} />
      )}
      {dialog?.kind === "pull-requests" && (
        <PullRequests onClose={() => setDialog(null)} />
      )}
    </>
  );
}
