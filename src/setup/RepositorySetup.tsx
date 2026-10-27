import { useEffect, useState, type FormEvent } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  FolderGit2,
  FolderSearch,
  Plus,
} from "lucide-react";
import { platform, type FoundRepository } from "../platform";
import {
  samePath,
  setupModes,
  type Repository,
  type SetupMode,
} from "../repositories";
import { useI18n, type Key } from "../i18n/i18n";
import { DrawIcon } from "../ui/DrawIcon";
import { useFadeSwitch } from "../ui/useFadeSwitch";
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
    [busy, setBusy] = useState(false),
    [found, setFound] = useState<FoundRepository[]>([]);
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
    }
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (busy) return;
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
    try {
      // Adding a subfolder of a repository adds the whole repository.
      const location =
        mode === "open"
          ? await platform.repositoryRoot(destination)
          : destination;
      if (mode === "open" && isAdded(location))
        throw new Error(t("setup.error.duplicateRepository"));
      if (mode === "clone") await platform.clone(url.trim(), location);
      if (mode === "create") await platform.init(location);
      onComplete({
        id: crypto.randomUUID(),
        name: mode === "open" ? lastSegment(location) : resolvedName,
        path: location,
        kind: mode,
        url: mode === "clone" ? url.trim() : undefined,
      });
    } catch (failure) {
      const message =
        failure instanceof Error ? failure.message : String(failure);
      setError(
        message in platformErrors ? t(platformErrors[message]) : message,
      );
    } finally {
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
                  onClick={() => {
                    setMode(m);
                    setError("");
                  }}
                >
                  <DrawIcon icon={Icon} active={m === mode} />
                  {t(tab)}
                </button>
              );
            })}
          </div>
          <div className={`setup-page fade-switch ${phase}`}>
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
            <form onSubmit={submit}>
              <div className={`setup-fields ${mode}`}>
                {mode === "clone" && (
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
                  <small>
                    {t(
                      mode === "open" ? "setup.hint.open" : "setup.hint.other",
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
                <div className="setup-preview">
                  <span>{t("setup.localWorkspace")}</span>
                  <code>{destination}</code>
                </div>
              )}
              <p className="setup-demo">
                {platform.desktop
                  ? mode === "clone"
                    ? t("setup.note.signIn")
                    : "\u00a0"
                  : t("setup.note.browser")}
              </p>
              <p className="setup-error" role={error ? "alert" : undefined}>
                {error || "\u00a0"}
              </p>
              <div className="setup-actions">
                {onCancel && (
                  <button type="button" className="button" onClick={onCancel}>
                    {t("common.cancel")}
                  </button>
                )}
                <button
                  className="button primary"
                  type="submit"
                  disabled={busy}
                >
                  {t(
                    busy
                      ? mode === "clone"
                        ? "setup.cloning"
                        : "setup.working"
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
