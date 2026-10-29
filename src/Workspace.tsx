import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type CSSProperties,
} from "react";
import { AlertTriangle } from "lucide-react";
import { NavRail, type Mode } from "./chrome/NavRail";
import { StatusBar } from "./chrome/StatusBar";
import { TopBar } from "./chrome/TopBar";
import { SettingsDialog, ShortcutsDialog } from "./dialogs/InfoDialogs";
import { OperationDialog } from "./dialogs/OperationDialog";
import {
  opKey,
  operations,
  type OpContext,
  type OperationId,
} from "./dialogs/operations";
import { PullRequests, openPullRequests } from "./dialogs/PullRequests";
import type { GitBackend } from "./git/backend";
import type { RepoSnapshot } from "./git/types";
import type { Repository, SetupMode } from "./repositories";
import { RepositorySetup } from "./setup/RepositorySetup";
import type { Preferences } from "./App";
import { useI18n } from "./i18n/i18n";
import { platform } from "./platform";
import { PreviewContext } from "./preview/data";
import { useStoredState } from "./ui/hooks";
import { SidebarContext } from "./ui/Panes";
import { useNotify } from "./ui/Toast";
import { useFadeSwitch } from "./ui/useFadeSwitch";
import { UpdateDialog } from "./updates/UpdateDialog";
import { useUpdates } from "./updates/updates";
import { BranchesView } from "./views/branches/BranchesView";
import { ChangesView } from "./views/changes/ChangesView";
import { HistoryView } from "./views/history/HistoryView";
import type { RepoApi } from "./views/repoApi";

type Dialog =
  | { kind: "operation"; id: OperationId; context: OpContext }
  | { kind: "settings" | "shortcuts" | "pull-requests" | "update" };

export function Workspace({
  repository,
  repositories,
  backend,
  dark,
  preferences,
  onSwitchRepository,
  onAddRepository,
  onRemoveRepository,
}: {
  repository: Repository;
  repositories: Repository[];
  backend: GitBackend;
  dark: boolean;
  preferences: Preferences;
  onSwitchRepository: (id: string) => void;
  onAddRepository: (repository: Repository) => void;
  onRemoveRepository: (id: string) => void;
}) {
  const notify = useNotify();
  const { t, mode: uiMode } = useI18n();
  const updates = useUpdates();
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
  // Previews read files through the backend and draw 3D views to match the theme.
  const preview = useMemo(() => ({ backend, dark }), [backend, dark]);

  if (!snapshot)
    return loadError ? (
      <div className="load-error">
        <AlertTriangle />
        <h2>{t("load.title", { name: repository.name })}</h2>
        <code>{repository.path}</code>
        <p>{loadError}</p>
        <div className="row">
          <button className="button primary" onClick={refresh}>
            {t("load.retry")}
          </button>
          <button
            className="button"
            onClick={() => onRemoveRepository(repository.id)}
          >
            {t("load.remove")}
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
    setWorking(t("top.working.check"));
    const next = await act((b) => b.fetch());
    setWorking(null);
    if (next)
      notify(
        next.sync.behind
          ? t("fetch.newCommits", {
              count: next.sync.behind,
              upstream: next.sync.upstream ?? "",
            })
          : t("fetch.nothing"),
      );
  }

  /** Simple mode's one button: get others' work, then send ours. */
  async function sync() {
    setWorking(t("top.working.sync"));
    await act(async (b) => {
      await b.fetch();
      let state = (await b.snapshot()).sync;
      if (state.behind) await b.pull();
      state = (await b.snapshot()).sync;
      if (state.ahead || !state.upstream) await b.push();
    }, t("sync.done"));
    setWorking(null);
  }

  // Branches are a full-mode tool.
  const view = uiMode === "simple" && mode === "Branches" ? "Changes" : mode;

  return (
    <PreviewContext.Provider value={preview}>
      <TopBar
        snapshot={snapshot}
        repository={repository}
        repositories={repositories}
        working={working}
        pullRequests={demo ? openPullRequests : null}
        onFetch={fetchRemote}
        onSync={sync}
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
          mode={view}
          onMode={setMode}
          hasChanges={snapshot.files.length > 0}
          dark={dark}
          onToggleTheme={() => preferences.setTheme(dark ? "light" : "dark")}
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
          {view === "Changes" ? (
            <ChangesView repo={repo} phase={phase} />
          ) : view === "History" ? (
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
        onUpdate={() => setDialog({ kind: "update" })}
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
            const { id, context } = dialog;
            const op = operations[id];
            setDialog(null);
            setWorking(`${t(opKey(id, "title"))}…`);
            await act(
              (b) => op.run!(b, context, input),
              t(opKey(id, "done"), op.params(context, t, input)),
            );
            setWorking(null);
          }}
        />
      )}
      {dialog?.kind === "settings" && (
        <SettingsDialog
          preferences={preferences}
          onClose={() => setDialog(null)}
        />
      )}
      {dialog?.kind === "update" && updates.state.status === "available" && (
        <UpdateDialog
          update={updates.state.update}
          onClose={() => setDialog(null)}
        />
      )}
      {dialog?.kind === "shortcuts" && (
        <ShortcutsDialog onClose={() => setDialog(null)} />
      )}
      {dialog?.kind === "pull-requests" && (
        <PullRequests onClose={() => setDialog(null)} />
      )}
    </PreviewContext.Provider>
  );
}
