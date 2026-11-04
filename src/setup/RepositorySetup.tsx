import { useEffect, useRef, useState, type FormEvent } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  FolderGit2,
  FolderSearch,
  Plus,
} from "lucide-react";
import { DragStrip } from "../chrome/WindowControls";
import { errorText, explainError } from "../errors/explain";
import { appLog } from "../errors/log";
import { ErrorMessage, useErrorAction } from "../errors/notice";
import { CancelHandle, isCancelled } from "../git/cancel";
import { IncompleteClone } from "../git/cli/transfers";
import type { GitProgress } from "../git/progress";
import { useAccount } from "../github/account";
import { platform, type FoundRepository } from "../platform";
import {
  samePath,
  setupModes,
  type Repository,
  type SetupMode,
} from "../repositories";
import { useI18n, type Key } from "../i18n/i18n";
import { DrawIcon } from "../ui/DrawIcon";
import { useCancelAvailable } from "../ui/hooks";
import { useFadeSwitch } from "../ui/useFadeSwitch";
import {
  GitHubHeading,
  GitHubRepositoryList,
  GitHubSignInCard,
} from "./GitHubRepositories";
import { CloneProgress } from "./CloneProgress";
import { setupModeMeta } from "./modes";
import { SetupArt } from "./SetupArt";

const lastSegment = (value: string) =>
  value
    .trim()
    .replace(/[\\/]+$/, "")
    .split(/[\\/:]/)
    .pop() || "";

/** Errors the platform reports by code; anything else is git's own message. */
const platformErrors: Record<string, Key> = {
  "folder-missing": "setup.error.folderMissing",
  "not-a-repository": "setup.error.notRepository",
};

export function RepositorySetup({
  initialMode,
  repositories,
  onCancel,
  onComplete,
}: {
  initialMode: SetupMode;
  repositories: Repository[];
  /** Absent on first launch, when there is no workspace to go back to. */
  onCancel?: () => void;
  onComplete: (repo: Repository) => void;
}) {
  const [mode, setMode, phase] = useFadeSwitch(initialMode);
  const { t } = useI18n();
  const [name, setName] = useState(""),
    [path, setPath] = useState("D:\\Projects"),
    [url, setUrl] = useState(""),
    [error, setError] = useState(""),
    /** What git or Windows said when cloning, creating or opening failed. */
    [failure, setFailure] = useState(""),
    [busy, setBusy] = useState(false),
    [progress, setProgress] = useState<GitProgress | null>(null),
    [found, setFound] = useState<FoundRepository[]>([]),
    [pasteLink, setPasteLink] = useState(false),
    /** Calm news, such as a clone the person stopped. */
    [notice, setNotice] = useState(""),
    /** Stops the clone under way, offered while that is safe. */
    [cancel, setCancel] = useState<CancelHandle | null>(null),
    /** A clone that can be opened but lacks Git LFS files: offers «Докачать». */
    [incomplete, setIncomplete] = useState<{
      repository: Repository;
      /** The error, CancelledError, or null for an earlier attempt's folder. */
      reason: unknown;
    } | null>(null);
  const cancellable = useCancelAvailable(cancel);
  /**
   * A clone that can be opened joins the list however this screen is left;
   * leaving stops a clone under way.
   */
  const usable = useRef<Repository | null>(null);
  const running = useRef<CancelHandle | null>(null);
  const mounted = useRef(false);
  const complete = useRef(onComplete);
  useEffect(() => {
    complete.current = onComplete;
  });
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      running.current?.cancel();
      if (usable.current) complete.current(usable.current);
      usable.current = null;
    };
  }, []);
  const form = useRef<HTMLFormElement>(null);
  const { available: withGitHub, user } = useAccount();
  const errorAction = useErrorAction();
  // Cloning with GitHub available: a sign-in card or the account's repositories,
  // and the destination folder in the folder hint instead of its own block.
  const gitHubClone = mode === "clone" && withGitHub;
  const listing = gitHubClone && !!user && !pasteLink;
  useEffect(() => {
    platform.discoverRepositories().then(setFound);
  }, []);

  const resolvedName =
    mode === "create"
      ? name.trim()
      : mode === "clone"
        ? lastSegment(url).replace(/\.git$/, "")
        : lastSegment(path);
  const destination =
    mode === "open"
      ? path.trim()
      : `${path.trim().replace(/[\\/]+$/, "")}${path.includes("\\") ? "\\" : "/"}${resolvedName}`;
  const isAdded = (location: string) =>
    repositories.some((r) => samePath(r.path, location));

  async function browse() {
    const folder = await platform.pickFolder();
    if (folder) {
      setPath(folder);
      setError("");
      setFailure("");
    }
  }

  function finish(repository: Repository) {
    usable.current = null;
    onComplete(repository);
  }

  /** The project can be opened, but some of its files are missing. */
  function holdIncomplete(repository: Repository, reason: unknown) {
    if (reason && !isCancelled(reason))
      appLog.error(
        `Downloading LFS files for ${repository.path}`,
        errorText(reason),
      );
    // Left while it downloaded: the project goes into the list all the same.
    if (!mounted.current) return complete.current(repository);
    usable.current = repository;
    setIncomplete({ repository, reason });
  }

  function startCancel() {
    const handle = new CancelHandle();
    running.current = handle;
    setCancel(handle);
    return handle;
  }

  /** «Докачать»: the Git LFS files the clone didn't get to. */
  async function resume({ repository }: NonNullable<typeof incomplete>) {
    setBusy(true);
    setProgress(null);
    setNotice("");
    try {
      await platform.resumeClone(repository.path, {
        onProgress: setProgress,
        cancel: startCancel(),
      });
      finish(repository);
    } catch (reason) {
      holdIncomplete(repository, reason);
    } finally {
      running.current = null;
      setCancel(null);
      setBusy(false);
    }
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (busy) return;
    if (incomplete) return resume(incomplete);
    if (listing && !url.trim()) return setError(t("setup.github.pick"));
    if (!resolvedName || !path.trim())
      return setError(t("setup.error.nameLocation"));
    if (
      mode === "clone" &&
      !/^(https?:\/\/[^/\s]+\/.+|git@[^:\s]+:.+)$/i.test(url.trim())
    )
      return setError(t("setup.error.url"));
    if (mode === "create" && /[\\/:*?"<>|]/.test(name))
      return setError(t("setup.error.folderName"));
    if (isAdded(destination)) return setError(t("setup.error.duplicate"));
    setBusy(true);
    setError("");
    setFailure("");
    setNotice("");
    const repository = (location: string): Repository => ({
      id: crypto.randomUUID(),
      name: mode === "open" ? lastSegment(location) : resolvedName,
      path: location,
      kind: mode,
      url: mode === "clone" ? url.trim() : undefined,
    });
    try {
      // Adding a subfolder of a repository adds the whole repository.
      const location =
        mode === "open"
          ? await platform.repositoryRoot(destination)
          : destination;
      if (mode === "open" && isAdded(location))
        throw new Error(t("setup.error.duplicateRepository"));
      if (mode === "clone") {
        setProgress(null);
        try {
          await platform.clone(url.trim(), location, {
            onProgress: setProgress,
            cancel: startCancel(),
          });
        } catch (failure) {
          if (!(failure instanceof IncompleteClone)) throw failure;
          return holdIncomplete(repository(location), failure.reason);
        }
      }
      if (mode === "create") await platform.init(location);
      finish(repository(location));
    } catch (failure) {
      // Stopped on request; the folder it had begun is gone again.
      if (isCancelled(failure)) return setNotice(t("setup.cancelled"));
      const message = errorText(failure);
      if (message in platformErrors) setError(t(platformErrors[message]));
      else {
        appLog.error(`Setting up ${destination} (${mode})`, message);
        setFailure(message);
      }
    } finally {
      running.current = null;
      setCancel(null);
      setBusy(false);
    }
  }

  return (
    <section
      className="repository-setup"
      role="dialog"
      aria-modal="true"
      aria-label={t(setupModeMeta[mode].tab)}
    >
      <DragStrip />
      <div className="setup-left">
        {onCancel ? (
          <button className="text-button setup-back" onClick={onCancel}>
            <ArrowLeft />
            {t("setup.back")}
          </button>
        ) : (
          <span className="setup-back" />
        )}
        <div className="setup-content">
          <div className="setup-tabs" role="tablist">
            {setupModes.map((m) => {
              const { tab, Icon } = setupModeMeta[m];
              return (
                <button
                  key={m}
                  role="tab"
                  aria-selected={m === mode}
                  className={m === mode ? "active" : ""}
                  // A half-downloaded project is settled first.
                  disabled={!!incomplete && m !== mode}
                  onClick={() => {
                    setMode(m);
                    setError("");
                    setFailure("");
                    setNotice("");
                  }}
                >
                  <DrawIcon icon={Icon} active={m === mode} />
                  {t(tab)}
                </button>
              );
            })}
          </div>
          <div
            className={`setup-page fade-switch ${phase} ${listing ? "listing" : ""}`}
          >
            <div className="setup-intro">
              <div className="eyebrow">{t("setup.eyebrow")}</div>
              <h1>
                {t(`setup.${mode}.titleStart` as Key)}{" "}
                <em>{t(`setup.${mode}.titleEm` as Key)}</em>
              </h1>
              <p className="setup-description">
                {t(`setup.${mode}.text` as Key)}
              </p>
            </div>
            <form ref={form} onSubmit={submit}>
              {/* A half-downloaded project is settled before anything else. */}
              <fieldset className="setup-lock" disabled={!!incomplete}>
                <div
                  className={`setup-fields ${mode} ${gitHubClone ? "github" : ""} ${listing ? "listing" : ""}`}
                >
                  {gitHubClone && user === null && <GitHubSignInCard />}
                  {gitHubClone && user && pasteLink && (
                    <GitHubHeading user={user}>
                      <button
                        type="button"
                        className="text-button"
                        onClick={() => setPasteLink(false)}
                      >
                        {t("setup.github.backToList")}
                      </button>
                    </GitHubHeading>
                  )}
                  {listing && user && (
                    <GitHubRepositoryList
                      key={user.login}
                      user={user}
                      url={url}
                      onPick={(picked) => {
                        setUrl(picked);
                        setError("");
                      }}
                      onSubmit={() => form.current?.requestSubmit()}
                      onManual={() => setPasteLink(true)}
                    />
                  )}
                  {mode === "clone" && !listing && (
                    <label>
                      {t("setup.url")}
                      <input
                        autoFocus
                        value={url}
                        onChange={(e) => setUrl(e.target.value)}
                        placeholder="https://github.com/owner/repository.git"
                        required
                      />
                      <small>{t("setup.urlHint")}</small>
                    </label>
                  )}
                  {mode === "create" && (
                    <label>
                      {t("setup.name")}
                      <input
                        autoFocus
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        placeholder="my-next-project"
                        required
                      />
                    </label>
                  )}
                  <label>
                    {t(`setup.folder.${mode}` as Key)}
                    <span className="path-field">
                      <input
                        value={path}
                        onChange={(e) => setPath(e.target.value)}
                        placeholder="D:\Projects"
                        required
                      />
                      <button type="button" className="button" onClick={browse}>
                        <FolderSearch />
                        {t("setup.browse")}
                      </button>
                    </span>
                    <small className={gitHubClone ? "setup-destination" : ""}>
                      {gitHubClone && resolvedName
                        ? t("setup.destination", { path: destination })
                        : t(
                            mode === "open"
                              ? "setup.hint.open"
                              : "setup.hint.other",
                          )}
                    </small>
                  </label>
                  {mode === "create" && (
                    <div className="setup-default">
                      <Check />
                      {t("setup.initialBranch")} <code>main</code>
                    </div>
                  )}
                </div>
              </fieldset>
              {mode === "open" ? (
                <div className="found-repos" aria-label={t("setup.found")}>
                  <div className="found-heading">{t("setup.found")}</div>
                  {found.map((f) => {
                    const added = isAdded(f.path);
                    return (
                      <button
                        type="button"
                        key={f.path}
                        className="found-repo"
                        disabled={added}
                        title={
                          added
                            ? t("setup.alreadyAdded")
                            : t("setup.addPath", { path: f.path })
                        }
                        onClick={() =>
                          onComplete({
                            id: crypto.randomUUID(),
                            name: f.name,
                            path: f.path,
                            kind: "open",
                          })
                        }
                      >
                        <FolderGit2 />
                        <span className="found-name">
                          <strong>{f.name}</strong>
                          <small>{f.path}</small>
                        </span>
                        <span className="found-meta">
                          {f.unity && <em>Unity {f.unity}</em>}
                          <em>{f.source}</em>
                        </span>
                        <span className="found-action">
                          {added ? (
                            <>
                              <Check /> {t("setup.added")}
                            </>
                          ) : (
                            <>
                              <Plus /> {t("setup.add")}
                            </>
                          )}
                        </span>
                      </button>
                    );
                  })}
                </div>
              ) : (
                !gitHubClone && (
                  <div className="setup-preview">
                    <span>{t("setup.localWorkspace")}</span>
                    <code>{destination}</code>
                  </div>
                )
              )}
              {/* On the desktop the GitHub card or list takes this room instead of the note. */}
              {!(platform.desktop && gitHubClone) && (
                <p className="setup-demo">
                  {platform.desktop
                    ? mode === "clone"
                      ? t("setup.note.signIn")
                      : "\u00a0"
                    : t("setup.note.browser")}
                </p>
              )}
              {busy && (mode === "clone" || incomplete) ? (
                <CloneProgress progress={progress} />
              ) : incomplete ? (
                <SetupIncomplete reason={incomplete.reason} />
              ) : failure ? (
                <SetupFailure
                  failure={failure}
                  fix={errorAction(explainError(failure), {
                    retry: () => form.current?.requestSubmit(),
                  })}
                />
              ) : notice && !error ? (
                <p className="setup-error setup-notice" role="status">
                  {notice}
                </p>
              ) : (
                <p className="setup-error" role={error ? "alert" : undefined}>
                  {error || "\u00a0"}
                </p>
              )}
              <div className="setup-actions">
                {busy && cancel ? (
                  <button
                    type="button"
                    className="button"
                    disabled={!cancellable}
                    title={t("cancel.title")}
                    onClick={() => cancel.cancel()}
                  >
                    {t("cancel.action")}
                  </button>
                ) : incomplete ? (
                  <button
                    type="button"
                    className="button"
                    disabled={busy}
                    onClick={() => finish(incomplete.repository)}
                  >
                    {t("setup.openIncomplete")}
                  </button>
                ) : (
                  onCancel && (
                    <button type="button" className="button" onClick={onCancel}>
                      {t("common.cancel")}
                    </button>
                  )
                )}
                <button
                  className="button primary"
                  type="submit"
                  disabled={busy}
                >
                  {t(
                    busy
                      ? mode === "clone" || incomplete
                        ? "setup.cloning"
                        : "setup.working"
                      : incomplete
                        ? "setup.resume"
                        : mode === "open"
                          ? "setup.submit.open"
                          : !platform.desktop
                            ? mode === "clone"
                              ? "setup.submit.clonePreview"
                              : "setup.submit.createPreview"
                            : mode === "clone"
                              ? "setup.submit.clone"
                              : "setup.submit.create",
                  )}
                  <ArrowRight />
                </button>
              </div>
            </form>
          </div>
        </div>
        <span className="setup-footer">{t("setup.footer")}</span>
      </div>
      <SetupArt onClose={onCancel} />
    </section>
  );
}

/** A clone that can be opened, and why some of its files are missing. */
function SetupIncomplete({ reason }: { reason: unknown }) {
  const { t } = useI18n();
  const error = reason && !isCancelled(reason) ? errorText(reason) : null;
  return (
    <div className="setup-incomplete" role="status">
      <p>
        {t(reason === null ? "setup.incomplete.earlier" : "setup.incomplete")}
      </p>
      {error && (
        <>
          <p>{t("setup.incomplete.error")}</p>
          <ErrorMessage error={error} className="setup-error" />
        </>
      )}
    </div>
  );
}

/** Plain words for a failed clone, create or open, and a fix when there is one (e.g. sign in). */
function SetupFailure({
  failure,
  fix,
}: {
  failure: string;
  fix?: { label: string; run: () => void };
}) {
  // The submit button already tries again; this is a fix such as signing in.
  const action = explainError(failure)?.action;
  const extra = fix && action && action !== "retry";
  return (
    <div className="setup-failure">
      <ErrorMessage error={failure} className="setup-error" />
      {extra && (
        <button type="button" className="button" onClick={fix.run}>
          {fix.label}
        </button>
      )}
    </div>
  );
}
