import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
} from "react";
import { NavRail, type Mode } from "./chrome/NavRail";
import { StatusBar } from "./chrome/StatusBar";
import { ToolbarMiddle } from "./chrome/ToolbarMiddle";
import { TopBar } from "./chrome/TopBar";
import { SettingsDialog, ShortcutsDialog } from "./dialogs/InfoDialogs";
import { OpenAppsDialog } from "./dialogs/OpenAppsDialog";
import { OperationDialog } from "./dialogs/OperationDialog";
import {
  opKey,
  operations,
  type OpContext,
  type OperationId,
} from "./dialogs/operations";
import { PullRequests, openPullRequests } from "./dialogs/PullRequests";
import type { GitBackend, TransferOptions } from "./git/backend";
import { CancelHandle, isCancelled } from "./git/cancel";
import { unresolved } from "./git/conflicts";
import type { GitProgress, ProgressListener } from "./git/progress";
import type { RepoSnapshot } from "./git/types";
import { groupWithMeta } from "./git/unity";
import type { Repository, SetupMode } from "./repositories";
import { RepositorySetup } from "./setup/RepositorySetup";
import type { Preferences } from "./App";
import { errorText, explainError } from "./errors/explain";
import { LoadError } from "./errors/LoadError";
import { useShowError } from "./errors/notice";
import { useI18n } from "./i18n/i18n";
import { useIdentity } from "./onboarding/identity";
import {
  confirmRewrite,
  incomingPaths,
  pullRewrites,
  type OpenAppWarning,
  type Rewrites,
} from "./openApps/openApps";
import { platform } from "./platform";
import { PreviewContext } from "./preview/data";
import { useBackgroundFetch } from "./sync/backgroundFetch";
import { progressLabel } from "./sync/progressText";
import { useCancelAvailable, useStoredState } from "./ui/hooks";
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
  | { kind: "open-apps"; warnings: OpenAppWarning[] }
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
  const showError = useShowError();
  const { ask: askIdentity } = useIdentity();
  const { t, mode: uiMode } = useI18n();
  const updates = useUpdates();
  const [snapshot, setSnapshot] = useState<RepoSnapshot>();
  const [mode, setMode, phase] = useFadeSwitch<Mode>("Changes");
  const [setup, setSetup] = useState<SetupMode | null>(null);
  const [dialog, setDialog] = useState<Dialog | null>(null);
  const [loadError, setLoadError] = useState<string>();
  /** What a long-running git operation is doing, shown in the top bar. */
  const [working, setWorking] = useState<string | null>(null);
  /** How far it got, when git says. */
  const [progress, setProgress] = useState<GitProgress | null>(null);
  /** Counts operations, so reports arriving after one ended are dropped. */
  const reports = useRef(0);
  /** Stops the operation under way, offered only while that is safe. */
  const [cancel, setCancel] = useState<CancelHandle | null>(null);
  const cancellable = useCancelAvailable(cancel);
  const [checking, setChecking] = useState(false);
  /** A file or commit to show when another view sends the user to Changes or History. */
  const [focus, setFocus] = useState<{
    changes?: string;
    history?: string;
    commit?: string;
  }>({});
  /** Each time something is sent to a view, it starts over on it. */
  const [jumps, setJumps] = useState({ changes: 0, history: 0 });
  const jump = (view: keyof typeof jumps) =>
    setJumps((j) => ({ ...j, [view]: j[view] + 1 }));
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
  /** What an error's "Sync" button does: Sync in simple mode, the Pull dialog in full. */
  const syncAfterError = useRef(() => {});
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
    async function attempt(action, success, again) {
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
        // Stopped on request: nothing went wrong, and nothing is lost.
        if (isCancelled(error)) {
          notify(t("cancel.done"));
          return refresh().then(() => null);
        }
        // Without a name and email nothing can be saved: ask, then go on as if nothing happened.
        if (
          explainError(errorText(error))?.action === "identity" &&
          (await askIdentity())
        )
          return attempt(action, success, again);
        showError(repository.path, error, {
          retry: () =>
            void (again ? again() : attempt(action, success, undefined)),
          sync: () => syncAfterError.current(),
        });
        await refresh();
        return null;
      }
    },
    [
      backend,
      notify,
      refresh,
      t,
      setMode,
      showError,
      askIdentity,
      repository.path,
    ],
  );

  /** Answers the open-programs question while it is on screen. */
  const answerOpenApps = useRef<((go: boolean) => void) | null>(null);
  /**
   * Before Rivet rewrites files on disk: when Unity or Blender has some of
   * them open, says what to save or close first. Resolves whether to go ahead.
   */
  function askBeforeRewrite(rewrites: Rewrites) {
    return confirmRewrite(
      () => platform.openApps(repository.path),
      rewrites,
      (warnings) =>
        new Promise<boolean>((resolve) => {
          answerOpenApps.current = (go) => {
            answerOpenApps.current = null;
            setDialog(null);
            resolve(go);
          };
          setDialog({ kind: "open-apps", warnings });
        }),
    );
  }

  /** Shows a long operation in the top bar; returns where its progress goes. */
  function startWorking(label: string): ProgressListener {
    const operation = ++reports.current;
    setWorking(label);
    setProgress(null);
    return (next) => {
      if (reports.current === operation) setProgress(next);
    };
  }
  function stopWorking() {
    reports.current++;
    setWorking(null);
    setProgress(null);
    setCancel(null);
  }
  /** A cancel handle for the operation starting now; the top bar offers it. */
  function startCancel() {
    const handle = new CancelHandle();
    setCancel(handle);
    return handle;
  }

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
    const onProgress = startWorking(t("incoming.taking"));
    if (await askBeforeRewrite(() => pullRewrites(backend))) {
      const cancel = startCancel();
      await act(
        (b) => b.pull({ onProgress, cancel }),
        t(opKey("pull", "done")),
      );
    }
    stopWorking();
  }

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      if (answerOpenApps.current) return answerOpenApps.current(false);
      setDialog(null);
      setSetup(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
  const downloadLfs = useCallback(
    (transfer?: TransferOptions) =>
      act((b) => b.lfsPull(transfer), t("lfs.downloaded")),
    [act, t],
  );
  // Previews read files through the backend and draw 3D views to match the theme.
  const reveal = useMemo(
    () =>
      platform.desktop && repository.kind !== "demo"
        ? (path: string) => platform.revealFile(repository.path, path)
        : undefined,
    [repository],
  );
  const preview = useMemo(
    () => ({ backend, dark, downloadLfs, reveal }),
    [backend, dark, downloadLfs, reveal],
  );

  if (!snapshot)
    return loadError ? (
      <LoadError
        repository={repository}
        error={loadError}
        onRetry={refresh}
        onRemove={() => onRemoveRepository(repository.id)}
      />
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
    const onProgress = startWorking(`${t(opKey(id, "title"))}…`);
    const rewrites = op.rewrites;
    if (
      rewrites &&
      !(await askBeforeRewrite(() =>
        rewrites(backend, context, latest.current ?? snapshot!),
      ))
    )
      return stopWorking();
    const cancel = startCancel();
    await act(
      (b) => op.run!(b, context, input, { onProgress, cancel }),
      t(opKey(id, "done"), op.params(context, t, input)),
    );
    stopWorking();
  }

  /** Nothing unsaved means nothing to lose or carry along, so no questions. */
  const switchBranch = (target: string) =>
    snapshot.files.length
      ? openOperation("switch-branch", { target })
      : runOperation("switch-branch", opContext({ target }));
  syncAfterError.current =
    uiMode === "simple" ? sync : () => openOperation("pull");
  const demo = !platform.desktop || repository.kind === "demo";
  const repo: RepoApi = {
    repository,
    demo,
    snapshot,
    backend,
    act,
    openOperation,
    sync,
    askBeforeRewrite,
    showChanges: (path) => {
      setFocus({ changes: path });
      jump("changes");
      setMode("Changes");
    },
    showFileHistory: (path) => {
      setFocus({ history: path });
      jump("history");
      setMode("History");
    },
    showCommit: (sha) => {
      setFocus({ commit: sha });
      jump("history");
      setMode("History");
    },
    switchBranch,
    blocked:
      snapshot.operation || unresolved(snapshot.files).length
        ? t("top.syncMerging")
        : working
          ? t("top.busy")
          : null,
    command: (id) => {
      if (id === "fetch") return fetchRemote();
      if (id === "theme") return preferences.setTheme(dark ? "light" : "dark");
      if (id === "history" || id === "branches") {
        setFocus({});
        return setMode(id === "history" ? "History" : "Branches");
      }
      setDialog({ kind: id });
    },
  };

  async function fetchRemote() {
    const onProgress = startWorking(t("top.working.check"));
    const cancel = startCancel();
    setChecking(true);
    const next = await act(
      (b) => b.fetch({ onProgress, cancel }),
      undefined,
      fetchRemote,
    );
    stopWorking();
    setChecking(false);
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
    const before = latest.current?.sync;
    const incoming = !!(before?.upstream && before.behind);
    let outcome = "sent" as "sent" | "stopped" | "too-large" | "cancelled";
    // One handle for every step: getting and sending can be stopped, merging can't.
    const cancel = startCancel();
    const next = await act(
      async (b) => {
        // The button says what happens right now: getting, then sending.
        const getting = startWorking(
          t(incoming ? "top.working.pull" : "top.working.check"),
        );
        await b.fetch({ onProgress: getting, cancel });
        let state = await b.snapshot();
        if (state.sync.behind) {
          if (!(await askBeforeRewrite(() => incomingPaths(b))))
            return (outcome = "cancelled");
          await b.pull({
            // The fetch brought the commits and showed it; what the pull
            // adds is mostly art files, which go on the same label.
            onProgress: incoming
              ? (p) => (p.phase === "download" ? getting(p) : undefined)
              : startWorking(t("top.working.pull")),
            cancel,
          });
          state = await b.snapshot();
          if (state.operation || unresolved(state.files).length)
            return (outcome = "stopped");
        }
        if (state.sync.tooLarge?.length) return (outcome = "too-large");
        if (state.sync.ahead || !state.sync.upstream)
          await b.push({
            onProgress: startWorking(t("top.working.push")),
            cancel,
          });
      },
      undefined,
      sync,
    );
    stopWorking();
    if (next && outcome === "sent") notify(t("sync.done"));
    if (next && outcome === "too-large")
      openOperation("push", { sync: next.sync });
  }

  // Branches are a full-mode tool.
  const view = uiMode === "simple" && mode === "Branches" ? "Changes" : mode;

  return (
    <PreviewContext.Provider value={preview}>
      <TopBar
        middle={<ToolbarMiddle repo={repo} />}
        snapshot={snapshot}
        repository={repository}
        repositories={repositories}
        working={working && progressLabel(working, progress, t)}
        progress={working ? progress : null}
        checking={checking}
        onCancel={cancellable ? () => cancel?.cancel() : undefined}
        pullRequests={demo ? openPullRequests : null}
        onFetch={fetchRemote}
        onSync={sync}
        onBranches={() => setMode("Branches")}
        onSwitchBranch={switchBranch}
        onSwitchRepository={onSwitchRepository}
        onRemoveRepository={onRemoveRepository}
        onSetup={setSetup}
        onPull={() => openOperation("pull")}
        onPush={() =>
          openOperation(snapshot.sync.upstream ? "push" : "publish")
        }
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
              key={jumps.changes}
              repo={repo}
              phase={phase}
              initialPath={focus.changes}
            />
          ) : view === "History" ? (
            <HistoryView
              key={`${focus.history ?? focus.commit}:${jumps.history}`}
              repo={repo}
              phase={phase}
              initialFile={focus.history}
              initialCommit={focus.commit}
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
      {dialog?.kind === "open-apps" && (
        <OpenAppsDialog
          warnings={dialog.warnings}
          onAnswer={(go) => answerOpenApps.current?.(go)}
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
