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

const intro = {
  clone: {
    title: (
      <>
        Clone a <em>repository.</em>
      </>
    ),
    text: "Start with a remote project and make it your own local workspace.",
  },
  open: {
    title: (
      <>
        Bring your work <em>together.</em>
      </>
    ),
    text: "Add a repository that is already on this computer. Your project stays where it is.",
  },
  create: {
    title: (
      <>
        Start something <em>new.</em>
      </>
    ),
    text: "Give your next project a home. Begin with a clean working tree and a main branch.",
  },
};

export function RepositorySetup({
  initialMode,
  repositories,
  onCancel,
  onComplete,
}: {
  initialMode: SetupMode;
  repositories: Repository[];
  onCancel: () => void;
  onComplete: (repo: Repository) => void;
}) {
  const [mode, setMode, phase] = useFadeSwitch(initialMode);
  const [name, setName] = useState(""),
    [path, setPath] = useState("D:\\Projects"),
    [url, setUrl] = useState(""),
    [error, setError] = useState(""),
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

  function submit(e: FormEvent) {
    e.preventDefault();
    if (!resolvedName || !path.trim())
      return setError("Enter a repository name and location.");
    if (
      mode === "clone" &&
      !/^(https?:\/\/[^/\s]+\/.+|git@[^:\s]+:.+)$/i.test(url.trim())
    )
      return setError("Enter an HTTPS or SSH repository URL.");
    if (mode === "create" && /[\\/:*?"<>|]/.test(name))
      return setError("Use a folder name without special path characters.");
    if (isAdded(destination))
      return setError("This location is already in your repository list.");
    onComplete({
      id: crypto.randomUUID(),
      name: resolvedName,
      path: destination,
      kind: mode,
      url: mode === "clone" ? url.trim() : undefined,
    });
  }

  return (
    <section
      className="repository-setup"
      role="dialog"
      aria-modal="true"
      aria-label={setupModeMeta[mode].menu.replace("…", "")}
    >
      <div className="setup-left">
        <button className="text-button setup-back" onClick={onCancel}>
          <ArrowLeft />
          Back to workspace
        </button>
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
                  {tab}
                </button>
              );
            })}
          </div>
          <div className={`setup-page fade-switch ${phase}`}>
            <div className="setup-intro">
              <div className="eyebrow">A PLACE FOR YOUR NEXT IDEA</div>
              <h1>{intro[mode].title}</h1>
              <p className="setup-description">{intro[mode].text}</p>
            </div>
            <form onSubmit={submit}>
              <div className={`setup-fields ${mode}`}>
                {mode === "clone" && (
                  <label>
                    Repository URL
                    <input
                      autoFocus
                      value={url}
                      onChange={(e) => setUrl(e.target.value)}
                      placeholder="https://github.com/owner/repository.git"
                      required
                    />
                    <small>
                      HTTPS and SSH URLs are supported in this preview.
                    </small>
                  </label>
                )}
                {mode === "create" && (
                  <label>
                    Repository name
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
                  {mode === "open"
                    ? "Repository folder"
                    : mode === "clone"
                      ? "Where to clone"
                      : "Parent folder"}
                  <span className="path-field">
                    <input
                      value={path}
                      onChange={(e) => setPath(e.target.value)}
                      placeholder="D:\Projects"
                      required
                    />
                    <button type="button" className="button" onClick={browse}>
                      <FolderSearch />
                      Browse…
                    </button>
                  </span>
                  <small>
                    {mode === "open"
                      ? "Choose a folder, or pick one of the projects found below."
                      : "The repository will use its own subfolder."}
                  </small>
                </label>
                {mode === "create" && (
                  <div className="setup-default">
                    <Check />
                    Initial branch <code>main</code>
                  </div>
                )}
              </div>
              {mode === "open" ? (
                <div
                  className="found-repos"
                  aria-label="Repositories found on this computer"
                >
                  <div className="found-heading">FOUND ON THIS COMPUTER</div>
                  {found.map((f) => {
                    const added = isAdded(f.path);
                    return (
                      <button
                        type="button"
                        key={f.path}
                        className="found-repo"
                        disabled={added}
                        title={added ? "Already in your list" : `Add ${f.path}`}
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
                              <Check /> Added
                            </>
                          ) : (
                            <>
                              <Plus /> Add
                            </>
                          )}
                        </span>
                      </button>
                    );
                  })}
                </div>
              ) : (
                <div className="setup-preview">
                  <span>LOCAL WORKSPACE</span>
                  <code>{destination}</code>
                </div>
              )}
              <p className="setup-demo">
                UI preview · Saves an entry in this browser. No folders are
                created, read or cloned.
              </p>
              <p className="setup-error" role={error ? "alert" : undefined}>
                {error || "\u00a0"}
              </p>
              <div className="setup-actions">
                <button type="button" className="button" onClick={onCancel}>
                  Cancel
                </button>
                <button className="button primary" type="submit">
                  {mode === "clone"
                    ? "Add clone preview"
                    : mode === "open"
                      ? "Add repository"
                      : "Create preview"}
                  <ArrowRight />
                </button>
              </div>
            </form>
          </div>
        </div>
        <span className="setup-footer">Your repositories. Your workflow.</span>
      </div>
      <SetupArt onClose={onCancel} />
    </section>
  );
}
