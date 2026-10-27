import { useState } from "react";
import { useFadeSwitch } from "./useFadeSwitch";
import {
  ArrowLeft,
  ArrowRight,
  FolderOpen,
  FolderPlus,
  GitFork,
  Check,
  X,
} from "lucide-react";

export type Repository = {
  id: string;
  name: string;
  path: string;
  kind: "demo" | "create" | "open" | "clone";
  url?: string;
};
export type SetupMode = "clone" | "open" | "create";
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
    [error, setError] = useState("");
  const labels = {
    clone: "Clone a repository",
    open: "Add a repository",
    create: "Create a repository",
  };
  const resolvedName =
    mode === "create"
      ? name.trim()
      : mode === "clone"
        ? url
            .trim()
            .replace(/\/+$/, "")
            .split(/[/:]/)
            .pop()
            ?.replace(/\.git$/, "") || ""
        : path
            .trim()
            .replace(/[\\/]+$/, "")
            .split(/[\\/]/)
            .pop() || "";
  const destination =
    mode === "open"
      ? path.trim()
      : `${path.trim().replace(/[\\/]+$/, "")}${path.includes("\\") ? "\\" : "/"}${resolvedName}`;
  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!resolvedName || !path.trim()) {
      setError("Enter a repository name and location.");
      return;
    }
    if (
      mode === "clone" &&
      !/^(https?:\/\/[^/\s]+\/.+|git@[^:\s]+:.+)$/i.test(url.trim())
    ) {
      setError("Enter an HTTPS or SSH repository URL.");
      return;
    }
    if (mode === "create" && /[\\/:*?"<>|]/.test(name)) {
      setError("Use a folder name without special path characters.");
      return;
    }
    if (
      repositories.some(
        (r) =>
          r.path.replace(/\\/g, "/").toLowerCase() ===
          destination.replace(/\\/g, "/").toLowerCase(),
      )
    ) {
      setError("This location is already in your repository list.");
      return;
    }
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
      aria-label={labels[mode]}
    >
      <div className="setup-left">
        <button className="text-button setup-back" onClick={onCancel}>
          <ArrowLeft />
          Back to workspace
        </button>
        <div className="setup-content">
          <div className="setup-tabs">
            {(["clone", "open", "create"] as const).map((m) => (
              <button
                key={m}
                className={m === mode ? "active" : ""}
                onClick={() => {
                  setMode(m);
                  setError("");
                }}
              >
                {m === "clone" ? (
                  <GitFork />
                ) : m === "open" ? (
                  <FolderOpen />
                ) : (
                  <FolderPlus />
                )}
                {m === "open"
                  ? "Add existing"
                  : m === "create"
                    ? "Create new"
                    : "Clone"}
              </button>
            ))}
          </div>
          <div className={`setup-page fade-switch ${phase}`}>
            <div className="setup-intro">
              <div className="eyebrow">A PLACE FOR YOUR NEXT IDEA</div>
              <h1>
                {mode === "clone" ? (
                  <>
                    Clone a <em>repository.</em>
                  </>
                ) : mode === "open" ? (
                  <>
                    Bring your work <em>together.</em>
                  </>
                ) : (
                  <>
                    Start something <em>new.</em>
                  </>
                )}
              </h1>
              <p className="setup-description">
                {mode === "clone"
                  ? "Start with a remote project and make it your own local workspace."
                  : mode === "open"
                    ? "Add an existing local repository to your workspace. Your project stays where it is."
                    : "Give your next project a home. Begin with a clean working tree and a main branch."}
              </p>
            </div>
            <form onSubmit={submit}>
              <div className="setup-fields">
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
                  <input
                    value={path}
                    onChange={(e) => setPath(e.target.value)}
                    placeholder="D:\Projects"
                    required
                  />
                  <small>
                    {mode === "open"
                      ? "Enter the path to your existing repository."
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
              <div className="setup-preview">
                <span>LOCAL WORKSPACE</span>
                <code>{destination}</code>
              </div>
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
      <aside className="setup-art">
        <button
          className="setup-close icon-button"
          aria-label="Close repository setup"
          onClick={onCancel}
        >
          <X />
        </button>
        <div className="art-label">
          <span className="brand-mark">r</span> MAKE ROOM FOR WHAT’S NEXT
        </div>
        <svg
          className="repo-illustration"
          viewBox="0 0 440 430"
          role="img"
          aria-label="Connected repository folders and commit paths"
        >
          <defs>
            <pattern
              id="art-grid"
              width="24"
              height="24"
              patternUnits="userSpaceOnUse"
            >
              <circle cx="1" cy="1" r="1" fill="#d4e2ba" opacity=".18" />
            </pattern>
          </defs>
          <rect width="440" height="430" fill="url(#art-grid)" />
          <ellipse
            cx="225"
            cy="365"
            rx="140"
            ry="15"
            fill="#193e35"
            opacity=".22"
          />
          <g fill="none" stroke="#d7e4bc" strokeWidth="2">
            <path
              d="M92 142V254Q92 280 120 280H218M343 120V227Q343 249 317 249H240"
              strokeDasharray="5 7"
            />
            <path d="M218 306V365M198 365H238" />
          </g>
          <g transform="translate(116 176) rotate(-7 105 70)">
            <path
              d="M0 18Q0 6 12 6H77L95 24H202Q214 24 214 36V147Q214 160 201 160H13Q0 160 0 147Z"
              fill="#aabb91"
              stroke="#183d34"
              strokeWidth="2"
            />
            <path
              d="M0 55Q0 43 13 43H201Q214 43 214 55V147Q214 160 201 160H13Q0 160 0 147Z"
              fill="#dbe6bc"
              stroke="#183d34"
              strokeWidth="2"
            />
            <path
              d="M80 84V119Q80 131 93 131H124Q137 131 137 117V99"
              fill="none"
              stroke="#356e5d"
              strokeWidth="4"
            />
            <g fill="#dbe6bc" stroke="#356e5d" strokeWidth="4">
              <circle cx="80" cy="80" r="7" />
              <circle cx="80" cy="126" r="7" />
              <circle cx="137" cy="92" r="7" />
            </g>
          </g>
          <g transform="translate(56 82) rotate(-13)">
            <rect
              width="83"
              height="72"
              rx="8"
              fill="#dbe6bc"
              stroke="#183d34"
              strokeWidth="2"
            />
            <path
              d="M18 24H63M18 35H56M18 46H45"
              stroke="#356e5d"
              strokeWidth="2"
            />
          </g>
          <g transform="translate(294 64) rotate(12)">
            <rect
              width="85"
              height="79"
              rx="9"
              fill="#dbe6bc"
              stroke="#183d34"
              strokeWidth="2"
            />
            <path
              d="M24 25L14 39L24 52M60 25L70 39L60 52M48 22L36 55"
              fill="none"
              stroke="#356e5d"
              strokeWidth="3"
            />
          </g>
          <g fill="#dbe6bc">
            <circle cx="209" cy="85" r="5" />
            <path
              d="M197 119H217M207 109V129"
              stroke="#dbe6bc"
              strokeWidth="2"
            />
          </g>
        </svg>
        <h2>
          A clearer view.
          <br />A little more flow.
        </h2>
        <p>
          Everything you need to follow your changes,
          <br />
          from the first commit to what comes next.
        </p>
        <div className="art-bottom">
          BUILT AROUND GIT <span>01 — YOUR WORKSPACE</span>
        </div>
      </aside>
    </section>
  );
}
