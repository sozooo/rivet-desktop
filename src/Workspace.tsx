import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
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
import { unresolved } from "./git/conflicts";
import type { RepoSnapshot } from "./git/types";
import { groupWithMeta } from "./git/unity";
import type { Repository, SetupMode } from "./repositories";
import { RepositorySetup } from "./setup/RepositorySetup";
import type { Preferences } from "./App";
import { explainError } from "./i18n/errors";
import { useI18n } from "./i18n/i18n";
import { platform } from "./platform";
import { PreviewContext } from "./preview/data";
import { useBackgroundFetch } from "./sync/backgroundFetch";
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
  /** A file to show when another view sends the user to Changes or History. */
  const [focus, setFocus] = useState<{ changes?: string; history?: string }>(
    {},
  );
  const [sidebarOpen, setSidebarOpen] = useStoredState(
    "rivet.sidebar.open",
    true,
  );
  const [sidebarWidth, setSidebarWidth] = useStoredState(
    "rivet.sidebar.width",
    310,
  );

  /** The latest snapshot, for comparing before and after an action. */
  const latest = useRef<RepoSnapshot>(undefined);
  const refresh = useCallback(async () => {
    try {
      const next = await backend.snapshot();
      latest.current = next;
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
      const conflictsBefore = unresolved(latest.current?.files ?? []).length;
      try {
        await action(backend);
        const next = await refresh();
        const conflicts = unresolved(next?.files ?? []).length;
        // A pull or a restore that stops on conflicts lands on the files to decide.
        if (conflicts && !conflictsBefore) {
          notify(t("merge.started", { count: conflicts }), "warning");
          setMode("Changes");
        } else if (success) notify(success);
        return next;
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        const known = explainError(message);
        notify(known ? t(known.key, known.params) : message, "error");
        await refresh();
        return null;
      }
    },
    [backend, notify, refresh, t, setMode],
  );

  // Teammates' work shows up by itself, with one button to bring it in.
  useBackgroundFetch({
    backend,
    snapshot,
    refresh,
    busy: !!working || !!dialog || !!setup,
    onIncoming: (next) =>
      notify(
        t("incoming.toast", {
          count: next.sync.behind,
          upstream: next.sync.upstream ?? "",
        }),
        "info",
        {
          queue: true,
          action: { label: t("incoming.take"), run: takeIncoming },
        },
      ),
  });
  async function takeIncoming() {
    const current = latest.current!;
    const context = {
      branch: current.branches.current,
      branches: current.branches.local,
      sync: current.sync,
    };
    if (uiMode === "full")
      return setDialog({ kind: "operation", id: "pull", context });
    setWorking(t("incoming.taking"));
    await act((b) => b.pull(), t(opKey("pull", "done")));
    setWorking(null);
  }

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      setDialog(null);
      setSetup(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
  const downloadLfs = useCallback(
    () => act((b) => b.lfsPull(), t("lfs.downloaded")),
    [act, t],
  );
  // Previews read files through the backend and draw 3D views to match the theme.
  const preview = useMemo(
    () => ({ backend, dark, downloadLfs }),
    [backend, dark, downloadLfs],
  );

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

  const opContext = (context: Partial<OpContext> = {}): OpContext => ({
    branch: snapshot.branches.current,
    branches: snapshot.branches.local,
    sync: snapshot.sync,
    changes: groupWithMeta(snapshot.files).length,
    ...context,
  });
  const openOperation = (id: OperationId, context: Partial<OpContext> = {}) =>
    setDialog({ kind: "operation", id, context: opContext(context) });

  async function runOperation(id: OperationId, context: OpContext, input = "") {
    const op = operations[id];
    setWorking(`${t(opKey(id, "title"))}…`);
    await act(
      (b) => op.run!(b, context, input),
      t(opKey(id, "done"), op.params(context, t, input)),
    );
    setWorking(null);
  }

  /** Nothing unsaved means nothing to lose or carry along, so no questions. */
  const switchBranch = (target: string) =>
    snapshot.files.length
      ? openOperation("switch-branch", { target })
      : runOperation("switch-branch", opContext({ target }));
  const demo = !platform.desktop || repository.kind === "demo";
  const repo: RepoApi = {
    repository,
    demo,
    snapshot,
    backend,
    act,
    openOperation,
    sync,
    showChanges: (path) => {
      setFocus({ changes: path });
      setMode("Changes");
    },
    showFileHistory: (path) => {
      setFocus({ history: path });
      setMode("History");
    },
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

  /**
   * Simple mode's one button: get others' work, then send ours. Conflicts
   * stop it before sending, and so do files GitHub would refuse.
   */
  async function sync() {
    setWorking(t("top.working.sync"));
    let outcome = "sent" as "sent" | "stopped" | "too-large";
    const next = await act(async (b) => {
      await b.fetch();
      let state = await b.snapshot();
      if (state.sync.behind) {
        await b.pull();
        state = await b.snapshot();
        if (state.operation || unresolved(state.files).length)
          return (outcome = "stopped");
      }
      if (state.sync.tooLarge?.length) return (outcome = "too-large");
      if (state.sync.ahead || !state.sync.upstream) await b.push();
    });
    setWorking(null);
    if (next && outcome === "sent") notify(t("sync.done"));
    if (next && outcome === "too-large")
      openOperation("push", { sync: next.sync });
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
        onSwitchBranch={switchBranch}
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
          onMode={(next) => {
            setFocus({});
            setMode(next);
          }}
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
            <ChangesView
              repo={repo}
              phase={phase}
              initialPath={focus.changes}
            />
          ) : view === "History" ? (
            <HistoryView
              key={focus.history}
              repo={repo}
              phase={phase}
              initialFile={focus.history}
            />
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
          onRun={(input) => {
            setDialog(null);
            runOperation(dialog.id, dialog.context, input);
          }}
        />
      )}
      {dialog?.kind === "settings" && (
        <SettingsDialog
          preferences={preferences}
          repo={repo}
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
