import React, { useState, useEffect } from "react";
import { createRoot } from "react-dom/client";
import {
  GitBranch,
  GitCommitHorizontal,
  History,
  Archive,
  Settings,
  Plus,
  Minus,
  ChevronDown,
  ChevronRight,
  ChevronUp,
  Search,
  RefreshCw,
  ArrowUp,
  ArrowDown,
  FolderGit2,
  PanelLeftClose,
  PanelLeftOpen,
  Columns2,
  AlignJustify,
  Check,
  X,
  FileCode2,
  FileJson2,
  FileText,
  MoreHorizontal,
  Command,
  Sun,
  Moon,
  Copy,
  CheckCircle2,
  ArrowRight,
  RotateCcw,
  CircleDot,
  GitPullRequest,
} from "lucide-react";
import "./style.css";
import { DiffHunk } from "./DiffHunk";
import { CommitFiles } from "./CommitFiles";
import { PullRequests } from "./PullRequests";
import { useFadeSwitch } from "./useFadeSwitch";
import {
  RepositorySetup,
  type Repository,
  type SetupMode,
} from "./RepositorySetup";

type Mode = "Changes" | "History" | "Branches" | "Stashes";
type Line = { kind: "context" | "add" | "del"; text: string };
type Hunk = { label: string; lines: Line[]; staged: boolean };
type FileChange = {
  id: number;
  name: string;
  path: string;
  status: string;
  hunks: Hunk[];
};
const lines = (
  before: string[],
  removed: string[],
  added: string[],
  after: string[],
): Line[] => [
  ...before.map((text) => ({ kind: "context" as const, text })),
  ...removed.map((text) => ({ kind: "del" as const, text })),
  ...added.map((text) => ({ kind: "add" as const, text })),
  ...after.map((text) => ({ kind: "context" as const, text })),
];
const seed: FileChange[] = [
  {
    id: 1,
    name: "PlayerController.cs",
    path: "Assets/Scripts/Player",
    status: "M",
    hunks: [
      {
        label:
          "@@ -12,12 +12,16 @@  public class PlayerController : MonoBehaviour",
        staged: false,
        lines: lines(
          [
            '    [Header("Movement")]',
            "    [SerializeField] private float moveSpeed = 5f;",
          ],
          ["    [SerializeField] private float jumpForce = 8f;"],
          [
            "    [SerializeField] private float jumpHeight = 2f;",
            "    [SerializeField] private float gravity = -9.81f;",
          ],
          [
            "",
            "    private CharacterController controller;",
            "    private Vector3 velocity;",
            "    private bool isGrounded;",
            "",
            "    private void Awake()",
            "    {",
            "        controller = GetComponent<CharacterController>();",
            "    }",
          ],
        ),
      },
      {
        label: "@@ -29,8 +33,13 @@  private void Update()",
        staged: false,
        lines: lines(
          ["    {", "        isGrounded = controller.isGrounded;", ""],
          ["        if (isGrounded) velocity.y = 0f;"],
          [
            "        if (isGrounded && velocity.y < 0)",
            "        {",
            "            velocity.y = -2f;",
            "        }",
          ],
          [
            "",
            '        float horizontal = Input.GetAxis("Horizontal");',
            '        float vertical = Input.GetAxis("Vertical");',
            "        Vector3 move = transform.right * horizontal",
            "                     + transform.forward * vertical;",
            "        controller.Move(move * moveSpeed * Time.deltaTime);",
            "    }",
          ],
        ),
      },
    ],
  },
  {
    id: 2,
    name: "CameraController.cs",
    path: "Assets/Scripts/Camera",
    status: "M",
    hunks: [
      {
        label: "@@ -8,4 +8,5 @@  LateUpdate()",
        staged: false,
        lines: lines(
          ["    private void LateUpdate()", "    {"],
          ["        transform.position = target.position + offset;"],
          [
            "        Vector3 destination = target.position + offset;",
            "        transform.position = Vector3.Lerp(transform.position, destination, damping * Time.deltaTime);",
          ],
          ["    }"],
        ),
      },
    ],
  },
  {
    id: 3,
    name: "InputManager.cs",
    path: "Assets/Scripts/Input",
    status: "A",
    hunks: [
      {
        label: "@@ -0,0 +1,9 @@",
        staged: false,
        lines: lines(
          [],
          [],
          [
            "using UnityEngine;",
            "",
            "public class InputManager : MonoBehaviour",
            "{",
            "    public Vector2 Movement => new Vector2(",
            '        Input.GetAxisRaw("Horizontal"),',
            '        Input.GetAxisRaw("Vertical")',
            "    );",
            "}",
          ],
          [],
        ),
      },
    ],
  },
  {
    id: 4,
    name: "manifest.json",
    path: "Packages",
    status: "M",
    hunks: [
      {
        label: "@@ -1,5 +1,5 @@",
        staged: false,
        lines: lines(
          ["{", '  "dependencies": {'],
          ['    "com.unity.inputsystem": "1.7.0"'],
          ['    "com.unity.inputsystem": "1.8.2"'],
          ["  }", "}"],
        ),
      },
    ],
  },
  {
    id: 5,
    name: "LegacyInput.cs",
    path: "Assets/Scripts/Input",
    status: "D",
    hunks: [
      {
        label: "@@ -1,4 +0,0 @@",
        staged: false,
        lines: lines(
          [],
          [
            "public static class LegacyInput",
            "{",
            "    public static float Speed = 5f;",
            "}",
          ],
          [],
          [],
        ),
      },
    ],
  },
  {
    id: 6,
    name: "README.md",
    path: "",
    status: "M",
    hunks: [
      {
        label: "@@ -4,3 +4,5 @@",
        staged: true,
        lines: lines(
          ["## Getting started", ""],
          ["Open the project in Unity."],
          [
            "Open the project in Unity 6.",
            "Use WASD to move and Space to jump.",
            "A gamepad is supported through the Input System.",
          ],
          [],
        ),
      },
    ],
  },
  {
    id: 7,
    name: "DefaultSettings.json",
    path: "Assets/Settings",
    status: "A",
    hunks: [
      {
        label: "@@ -0,0 +1,5 @@",
        staged: true,
        lines: lines(
          [],
          [],
          [
            "{",
            '  "sensitivity": 1.5,',
            '  "invertY": false,',
            '  "smoothing": true',
            "}",
          ],
          [],
        ),
      },
    ],
  },
  {
    id: 8,
    name: "PlayerOutline.shader",
    path: "Assets/Shaders",
    status: "M",
    hunks: [
      {
        label: "@@ -2,4 +2,4 @@",
        staged: true,
        lines: lines(
          ["Properties", "{"],
          ['    _OutlineWidth ("Width", Float) = 0.01'],
          ['    _OutlineWidth ("Width", Float) = 0.02'],
          ["}"],
        ),
      },
    ],
  },
  {
    id: 9,
    name: "ci.yml",
    path: ".github/workflows",
    status: "M",
    hunks: [
      {
        label: "@@ -1,4 +1,4 @@",
        staged: false,
        lines: lines(
          ["name: Unity checks", "on: [push, pull_request]"],
          ["timeout-minutes: 10"],
          ["timeout-minutes: 20"],
          [],
        ),
      },
    ],
  },
];
const initialCommits = [
  [
    "Improve camera follow smoothing",
    "Alex Morgan",
    "12 minutes ago",
    "a7c92e1",
  ],
  ["Merge branch feature/input", "Alex Morgan", "1 hour ago", "b3f18d0"],
  ["Add gamepad input support", "Jamie Chen", "2 hours ago", "d84e2a9"],
  [
    "Set up player movement and collision",
    "Alex Morgan",
    "Yesterday",
    "f1b03c7",
  ],
  [
    "Add outline shader for interactable objects",
    "Jamie Chen",
    "Yesterday",
    "e29a641",
  ],
  ["Configure automated editor tests", "Alex Morgan", "2 days ago", "82c6b05"],
  [
    "Create base scene and project structure",
    "Alex Morgan",
    "3 days ago",
    "4d791e2",
  ],
];
const navIcons = {
  Changes: FolderGit2,
  History,
  Branches: GitBranch,
  Stashes: Archive,
};
const gamepadFiles: FileChange[] = [
  seed[0],
  seed[1],
  seed[2],
  seed[3],
  seed[5],
  ...[
    ["XboxController.json", "Assets/Input/Profiles", "xbox", 1.0],
    ["DualSenseController.json", "Assets/Input/Profiles", "dualsense", 0.85],
    ["SwitchProController.json", "Assets/Input/Profiles", "switch-pro", 0.9],
    ["KeyboardMouse.json", "Assets/Input/Profiles", "keyboard-mouse", 1.0],
    ["InventoryNavigation.json", "Assets/Input/Bindings", "inventory", 0.75],
    ["MenuNavigation.json", "Assets/Input/Bindings", "menu", 0.8],
    ["Accessibility.json", "Assets/Input/Settings", "accessible", 0.65],
    ["DeadZoneSettings.json", "Assets/Input/Settings", "dead-zones", 0.15],
    ["GamepadHints.json", "Assets/UI/Localization", "en", 1.0],
  ].map(([name, path, profile, sensitivity], i) => ({
    id: 100 + i,
    name: String(name),
    path: String(path),
    status: "A",
    hunks: [
      {
        label: "@@ -0,0 +1,8 @@",
        staged: true,
        lines: lines(
          [],
          [],
          [
            "{",
            `  "profile": "${profile}",`,
            `  "sensitivity": ${sensitivity},`,
            '  "navigation": {',
            '    "repeatDelay": 0.25,',
            '    "wrapAround": true',
            "  }",
            "}",
          ],
          [],
        ),
      },
    ],
  })),
];
function Workspace({
  repository,
  repositories,
  onSwitch,
  onAdd,
  dark,
  setDark,
}: {
  repository: Repository;
  repositories: Repository[];
  onSwitch: (id: string) => void;
  onAdd: (r: Repository) => void;
  dark: boolean;
  setDark: (v: boolean) => void;
}) {
  const [setup, setSetup] = useState<SetupMode | null>(null);
  const repo = repository.name;
  const [mode, setMode, modePhase] = useFadeSwitch<Mode>("Changes");
  const [incoming, setIncoming] = useState(
    repository.kind === "create" ? 0 : 2,
  );
  const [lastFetched, setLastFetched] = useState("4 min ago");
  const [files, setFiles] = useState(
      repository.kind === "create" ? ([] as FileChange[]) : seed,
    ),
    [selected, setSelected] = useState(1),
    [side, setSide] = useState<"unstaged" | "staged">("unstaged"),
    [collapsed, setCollapsed] = useState(false),
    [sidebar, setSidebar] = useState(true),
    [width, setWidth] = useState(310),
    [split, setSplit] = useState(false),
    [whitespace, setWhitespace] = useState(false),
    [query, setQuery] = useState(""),
    [title, setTitle] = useState(""),
    [description, setDescription] = useState(""),
    [toast, setToast] = useState(""),
    [modal, setModal] = useState(""),
    [menu, setMenu] = useState(""),
    [commits, setCommits] = useState(
      repository.kind === "create" ? ([] as string[][]) : initialCommits,
    ),
    [commitIndex, setCommitIndex] = useState(0),
    [branch, setBranch] = useState(
      repository.kind === "create" ? "main" : "feature/player-movement",
    ),
    [chosenBranch, setChosenBranch] = useState(
      repository.kind === "create" ? "main" : "feature/player-movement",
    ),
    [ahead, setAhead] = useState(repository.kind === "create" ? 0 : 3),
    [stashes, setStashes] = useState(
      repository.kind === "create"
        ? ([] as string[])
        : ["WIP: inventory interaction", "Before camera refactor"],
    ),
    [stashIndex, setStashIndex] = useState(0),
    [fetching, setFetching] = useState(false),
    [details, setDetails] = useState(false),
    [newBranch, setNewBranch] = useState(""),
    [branches, setBranches] = useState(
      repository.kind === "create"
        ? ["main"]
        : ["main", "develop", "feature/player-movement", "fix/camera-jitter"],
    ),
    [readFile, setReadFile] = useState(1);
  const [savedDiffs, setSavedDiffs] = useState<Record<string, FileChange[]>>(
    {},
  );
  const [savedDescriptions, setSavedDescriptions] = useState<
    Record<string, string>
  >({});
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setModal("");
        setMenu("");
        setSetup(null);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);
  const inspectedFiles =
    mode === "History"
      ? savedDiffs[commits[commitIndex]?.[3]] ||
        (["a7c92e1", "d84e2a9"].includes(commits[commitIndex]?.[3])
          ? gamepadFiles
          : [
              seed[commitIndex % seed.length],
              seed[(commitIndex + 1) % seed.length],
            ])
      : [seed[stashIndex === 0 ? 2 : 1], seed[3]];
  const notify = (message: string) => {
    setToast(message);
    window.setTimeout(() => setToast(""), 3500);
  };
  const staged = files.filter((f) => f.hunks.some((h) => h.staged)),
    unstaged = files.filter((f) => f.hunks.some((h) => !h.staged));
  const current =
    mode === "Changes"
      ? files.find((f) => f.id === selected)
      : inspectedFiles.find((f) => f.id === readFile) || inspectedFiles[0];
  const changeStage = (id: number, value: boolean, hunk?: number) =>
    setFiles((all) =>
      all.map((f) =>
        f.id !== id
          ? f
          : {
              ...f,
              hunks: f.hunks.map((h, i) =>
                hunk === undefined || i === hunk ? { ...h, staged: value } : h,
              ),
            },
      ),
    );
  function selectMode(value: Mode) {
    setMode(value);
    setQuery("");
    setMenu("");
    setReadFile(1);
  }
  function commit() {
    if (!title.trim() || !staged.length) return;
    const sha = Math.random().toString(16).slice(2, 9);
    setSavedDiffs((d) => ({
      ...d,
      [sha]: staged.map((f) => ({
        ...f,
        hunks: f.hunks.filter((h) => h.staged),
      })),
    }));
    setSavedDescriptions((d) => ({ ...d, [sha]: description }));
    setCommits([[title.trim(), "You", "Just now", sha], ...commits]);
    setFiles((all) =>
      all
        .map((f) => ({ ...f, hunks: f.hunks.filter((h) => !h.staged) }))
        .filter((f) => f.hunks.length),
    );
    setAhead((a) => a + 1);
    setTitle("");
    setDescription("");
    notify("Commit created in the demo repository.");
  }
  function operation(action: string) {
    setDetails(false);
    setModal(action);
    setMenu("");
  }
  const perform = () => {
    if (modal === "Switch branch") {
      setBranch(chosenBranch);
    } else if (modal === "Push") {
      setAhead(0);
    } else if (modal === "Pull") {
      setIncoming(0);
      setCommits((c) => [
        ["Update shared input profiles", "Jamie Chen", "Just now", "82fb1a0"],
        [
          "Add controller navigation hints",
          "Sam Rivera",
          "Just now",
          "93cd2b1",
        ],
        ...c,
      ]);
    } else if (modal === "Drop stash" || modal === "Pop stash") {
      setStashes((s) => s.filter((_, i) => i !== stashIndex));
      setStashIndex(0);
    } else if (modal === "New branch") {
      if (!newBranch.trim() || branches.includes(newBranch.trim())) return;
      setBranches([...branches, newBranch.trim()]);
      setChosenBranch(newBranch.trim());
      setNewBranch("");
    } else if (modal === "Discard file") {
      setFiles((s) => s.filter((f) => f.id !== selected));
    }
    notify(
      `${modal} ${["Merge", "Rebase", "Apply stash", "Checkout", "Cherry-pick", "Revert"].includes(modal) ? "preview confirmed" : "completed"} in demo mode.`,
    );
    setModal("");
  };
  const fileIcon = (f: FileChange) =>
    f.name.endsWith(".json") ? (
      <FileJson2 />
    ) : f.name.endsWith(".md") || f.name.endsWith(".yml") ? (
      <FileText />
    ) : (
      <FileCode2 />
    );
  const fileRow = (f: FileChange, stage: boolean) => (
    <div
      key={`${f.id}-${stage}`}
      className={`file-row ${selected === f.id && side === (stage ? "staged" : "unstaged") ? "selected" : ""}`}
    >
      <button
        className="file-select"
        onClick={() => {
          setSelected(f.id);
          setSide(stage ? "staged" : "unstaged");
        }}
      >
        <span className={`file-icon ${f.name.endsWith(".cs") ? "csharp" : ""}`}>
          {fileIcon(f)}
        </span>
        <span className="file-label">
          <span>{f.name}</span>
          <small>{f.path || "Repository root"}</small>
        </span>
        <span
          className={`status status-${f.status}`}
          title={{ M: "Modified", A: "Added", D: "Deleted" }[f.status]}
        >
          {f.status}
        </span>
      </button>
      <button
        className="stage-control"
        title={stage ? "Unstage file" : "Stage file"}
        aria-label={`${stage ? "Unstage" : "Stage"} ${f.name}`}
        onClick={() => changeStage(f.id, !stage)}
      >
        {stage ? <Check size={12} /> : <Plus size={12} />}
      </button>
    </div>
  );
  function diff() {
    if (!current)
      return (
        <div className="empty">
          <CheckCircle2 />
          <h2>Everything in its place.</h2>
          <p>
            {files.length
              ? "Select a file to inspect its changes."
              : "Your working tree is clean."}
          </p>
        </div>
      );
    const visible = current.hunks
      .map((h, i) => ({ h, i }))
      .filter(
        ({ h }) => mode !== "Changes" || h.staged === (side === "staged"),
      );
    return (
      <>
        <div className="diff-title">
          <div className="file-heading">
            {fileIcon(current)}
            <strong>{current.name}</strong>
            <span className={`status status-${current.status}`}>
              {current.status}
            </span>
            <span className="diff-stats">
              <b>
                +
                {
                  current.hunks
                    .flatMap((h) => h.lines)
                    .filter((l) => l.kind === "add").length
                }
              </b>
              <em>
                −
                {
                  current.hunks
                    .flatMap((h) => h.lines)
                    .filter((l) => l.kind === "del").length
                }
              </em>
            </span>
          </div>
          <div className="row">
            <div className="segmented">
              <button
                className={!split ? "active" : ""}
                title="Unified diff"
                aria-label="Unified diff"
                onClick={() => setSplit(false)}
              >
                <AlignJustify />
              </button>
              <button
                className={split ? "active" : ""}
                title="Side-by-side diff"
                aria-label="Side-by-side diff"
                onClick={() => setSplit(true)}
              >
                <Columns2 />
              </button>
            </div>
            <button
              className="icon-button"
              title="File actions"
              onClick={() => setMenu(menu === "file" ? "" : "file")}
            >
              <MoreHorizontal />
            </button>
            {menu === "file" && (
              <div className="dropdown file-menu">
                <button
                  onClick={() => {
                    navigator.clipboard
                      .writeText(`${current.path}/${current.name}`)
                      .then(() => notify("Path copied"))
                      .catch(() => notify("Clipboard unavailable"));
                    setMenu("");
                  }}
                >
                  <Copy />
                  Copy path
                </button>
                {mode === "Changes" && (
                  <button
                    className="danger-text"
                    onClick={() => operation("Discard file")}
                  >
                    <RotateCcw />
                    Discard changes…
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
        <div className="diff-subbar">
          <span>
            {current.path || repo} <ChevronRight size={12} /> {current.name}
          </span>
          <div className="row">
            <button
              className={whitespace ? "text-button accent" : "text-button"}
              onClick={() => setWhitespace(!whitespace)}
              title="Toggle whitespace visibility"
            >
              ¶ <span>Whitespace</span>
            </button>
            <span className="separator" />
            <span>
              {mode === "Changes"
                ? side === "staged"
                  ? "Index → HEAD"
                  : "Working tree → Index"
                : "Commit → Parent"}
            </span>
          </div>
        </div>
        <div className="diff-scroll">
          {split && (
            <div className="split-label">
              <span>Original</span>
              <span>Modified</span>
            </div>
          )}
          {visible.length === 0 ? (
            <div className="empty">
              <CheckCircle2 />
              <h3>
                {side === "unstaged" ? "All hunks staged" : "No staged hunks"}
              </h3>
              <button
                className="button"
                onClick={() =>
                  setSide(side === "staged" ? "unstaged" : "staged")
                }
              >
                View {side === "staged" ? "unstaged" : "staged"} changes
              </button>
            </div>
          ) : (
            visible.map(({ h, i }) => (
              <DiffHunk
                key={i}
                hunk={h}
                split={split}
                whitespace={whitespace}
                editable={mode === "Changes"}
                onStage={() => changeStage(current.id, !h.staged, i)}
              />
            ))
          )}
        </div>
      </>
    );
  }
  return (
    <div
      className={`app ${dark ? "dark" : ""}`}
      style={{ "--sidebar-width": `${width}px` } as React.CSSProperties}
    >
      <header className="topbar">
        <div className="brand">
          <span className="brand-mark">r</span>
          <span>
            rivet<span className="brand-dot">.</span>
          </span>
        </div>
        <div className="branch-sync">
          <div className="branch-fetch-group">
            <button
              className="branch-selector"
              onClick={() => {
                selectMode("Branches");
                setChosenBranch(branch);
              }}
            >
              <GitBranch />
              <span title={`origin/${branch}`}>origin/{branch}</span>
              <ChevronDown size={13} />
            </button>
            <button
              className="fetch-control"
              title="Fetch: check for remote changes without modifying your files"
              aria-label="Fetch remote changes"
              disabled={fetching}
              onClick={() => {
                setFetching(true);
                setTimeout(() => {
                  setFetching(false);
                  setLastFetched("just now");
                  notify(
                    incoming
                      ? `${incoming} incoming commits found in the demo.`
                      : "Demo remotes checked. No incoming commits.",
                  );
                }, 900);
              }}
            >
              <RefreshCw className={fetching ? "spinning" : ""} />
              <span>{fetching ? "Checking…" : lastFetched}</span>
            </button>
          </div>
          <span className="sync-status" aria-live="polite">
            {incoming ? <ArrowDown /> : ahead ? <ArrowUp /> : <Check />}
            {incoming
              ? `${incoming} incoming commits${ahead ? ` · ${ahead} to publish` : ""}`
              : ahead
                ? `${ahead} commits ready to publish`
                : "You're up to date"}
          </span>
        </div>
        <div className="repo-wrap">
          <button
            className="repo-selector"
            onClick={() => setMenu(menu === "repo" ? "" : "repo")}
          >
            <FolderGit2 />
            {repo}
            <ChevronDown size={13} />
          </button>
          {menu === "repo" && (
            <div className="dropdown repository-menu">
              <small>YOUR REPOSITORIES</small>
              <div className="repository-list">
                {repositories.map((r) => (
                  <button
                    key={r.id}
                    onClick={() => {
                      setMenu("");
                      onSwitch(r.id);
                    }}
                  >
                    <FolderGit2 />
                    <span>
                      <strong>{r.name}</strong>
                      <small>{r.path}</small>
                    </span>
                    {repository.id === r.id && <Check />}
                  </button>
                ))}
              </div>
              <div className="repository-menu-actions">
                {(["open", "create", "clone"] as const).map((m) => (
                  <button
                    key={m}
                    onClick={() => {
                      setMenu("");
                      setSetup(m);
                    }}
                  >
                    <Plus />
                    {m === "open"
                      ? "Add existing repository…"
                      : m === "create"
                        ? "Create repository…"
                        : "Clone repository…"}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
        <div className="top-actions">
          <button
            className="text-button pr-trigger"
            onClick={() => setModal("Pull requests")}
            title="Browse open pull requests"
          >
            <GitPullRequest />
            <span>Pull requests</span>
            <span className="count">3</span>
          </button>
          <button
            className="button"
            disabled={!incoming}
            onClick={() => operation("Pull")}
            title="Pull incoming commits into the current branch"
          >
            <ArrowDown />
            Pull {incoming > 0 ? incoming : ""}
          </button>
          <button
            className="button push"
            disabled={!ahead}
            onClick={() => operation("Push")}
          >
            Push <ArrowUp size={14} />
            {ahead}
          </button>
          <span className="separator" />
          <button
            className="icon-button"
            title="New branch"
            onClick={() => operation("New branch")}
          >
            <Plus />
          </button>
        </div>
      </header>
      <div className="shell">
        <nav className="nav-rail">
          <div>
            {(["Changes", "History", "Branches", "Stashes"] as Mode[]).map(
              (m) => {
                const Icon = navIcons[m];
                return (
                  <button
                    key={m}
                    title={m}
                    aria-label={m}
                    className={mode === m ? "nav-item active" : "nav-item"}
                    onClick={() => selectMode(m)}
                  >
                    <Icon size={21} />
                    {m === "Changes" && files.length > 0 && <i />}
                  </button>
                );
              },
            )}
          </div>
          <div>
            <button
              className="nav-item"
              title={dark ? "Light theme" : "Dark theme"}
              aria-label="Toggle theme"
              onClick={() => setDark(!dark)}
            >
              {dark ? <Sun /> : <Moon />}
            </button>
            <button
              className="nav-item"
              title="Settings"
              aria-label="Settings"
              onClick={() => setModal("Settings")}
            >
              <Settings size={21} />
            </button>
            <span className="avatar" title="Demo user: Alex Morgan">
              AM
            </span>
          </div>
        </nav>
        {sidebar && (
          <>
            <aside className="sidebar">
              <div className="sidebar-title">
                <h1>{mode}</h1>
                <div className="row">
                  {mode === "Changes" && (
                    <span className="count">{files.length}</span>
                  )}
                  <button
                    className="icon-button"
                    title="Collapse sidebar"
                    onClick={() => setSidebar(false)}
                  >
                    <PanelLeftClose size={17} />
                  </button>
                </div>
              </div>
              <div className="search">
                <Search size={14} />
                <input
                  aria-label="Filter objects"
                  placeholder={
                    mode === "Changes"
                      ? "Filter files…"
                      : `Search ${mode.toLowerCase()}…`
                  }
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                />
                <span>⌕</span>
              </div>
              <div className={`sidebar-content fade-switch ${modePhase}`}>
                {mode === "Changes" ? (
                  <>
                    {[false, true].map((stage) => (
                      <section className="file-group" key={String(stage)}>
                        <div className="group-heading">
                          <span>
                            {stage ? "STAGED" : "UNSTAGED"}{" "}
                            <b>{(stage ? staged : unstaged).length}</b>
                          </span>
                          <button
                            className="text-button"
                            onClick={() =>
                              setFiles((all) =>
                                all.map((f) => ({
                                  ...f,
                                  hunks: f.hunks.map((h) => ({
                                    ...h,
                                    staged: !stage,
                                  })),
                                })),
                              )
                            }
                          >
                            {stage ? "Unstage all" : "Stage all"}{" "}
                            {stage ? <Minus size={12} /> : <Plus size={12} />}
                          </button>
                        </div>
                        {(stage ? staged : unstaged)
                          .filter((f) =>
                            `${f.path}/${f.name}`
                              .toLowerCase()
                              .includes(query.toLowerCase()),
                          )
                          .map((f) => fileRow(f, stage))}
                        {!(stage ? staged : unstaged).length && (
                          <p className="list-empty">
                            {stage
                              ? "Stage changes to build your commit."
                              : "Your working tree is clean."}
                          </p>
                        )}
                      </section>
                    ))}
                  </>
                ) : mode === "History" ? (
                  <>
                    <div className="group-heading">
                      <span>ALL COMMITS</span>
                      <span>{commits.length}</span>
                    </div>
                    {commits.map(
                      (c, i) =>
                        c[0].toLowerCase().includes(query.toLowerCase()) && (
                          <button
                            className={`commit-row ${commitIndex === i ? "selected" : ""}`}
                            key={c[3]}
                            onClick={() => setCommitIndex(i)}
                          >
                            <div
                              className={`graph-line ${c[3] === "d84e2a9" ? "graph-child" : c[3] === "b3f18d0" ? "graph-merge" : ""}`}
                            >
                              <svg
                                className="history-connector"
                                viewBox="0 0 28 100"
                                preserveAspectRatio="none"
                                aria-hidden="true"
                              >
                                {c[3] === "b3f18d0" ? (
                                  <path d="M6 24 C6 45 22 40 22 64 V100" />
                                ) : c[3] === "d84e2a9" ? (
                                  <path d="M22 0 V35 C22 65 6 65 6 100" />
                                ) : null}
                              </svg>
                              <i />
                            </div>
                            <div>
                              <strong>{c[0]}</strong>
                              <small>
                                {c[1]} · {c[2]}
                              </small>
                              {i === 0 && (
                                <span className="branch-chip">{branch}</span>
                              )}
                              {c[3] === "f1b03c7" && (
                                <span className="tag">main</span>
                              )}
                            </div>
                          </button>
                        ),
                    )}
                  </>
                ) : mode === "Branches" ? (
                  <>
                    {[
                      ["LOCAL", ...branches],
                      [
                        "REMOTE",
                        ...(repository.kind === "create"
                          ? []
                          : ["origin/main", "origin/develop"]),
                      ],
                      [
                        "TAGS",
                        ...(repository.kind === "create"
                          ? []
                          : ["v0.3.0", "v0.2.0"]),
                      ],
                    ].map(([label, ...items]) => (
                      <section key={label}>
                        <div className="group-heading">
                          <span>{label}</span>
                          <span>{items.length}</span>
                        </div>
                        {items
                          .filter((b) => b.includes(query))
                          .map((b) => (
                            <button
                              key={b}
                              className={`object-row ${chosenBranch === b ? "selected" : ""}`}
                              onClick={() => setChosenBranch(b)}
                            >
                              <GitBranch size={16} />
                              <span>{b}</span>
                              {b === branch && <Check size={14} />}
                            </button>
                          ))}
                      </section>
                    ))}
                  </>
                ) : (
                  <>
                    {stashes.map(
                      (s, i) =>
                        s.toLowerCase().includes(query.toLowerCase()) && (
                          <button
                            className={`stash-row ${stashIndex === i ? "selected" : ""}`}
                            key={s}
                            onClick={() => setStashIndex(i)}
                          >
                            <Archive size={17} />
                            <div>
                              <small>stash@{"{" + i + "}"}</small>
                              <strong>{s}</strong>
                              <small>
                                {i === 0 ? "2 hours ago" : "Yesterday"}
                              </small>
                            </div>
                          </button>
                        ),
                    )}
                    {!stashes.length && (
                      <p className="list-empty">No saved stashes.</p>
                    )}
                  </>
                )}
              </div>
              <div className="sidebar-footer">
                <span className="status-dot" />{" "}
                {mode === "Changes"
                  ? "Working tree updated"
                  : "Local repository"}
                <span className="muted">Demo</span>
              </div>
            </aside>
            <div
              className="resize-handle"
              onPointerDown={(e) => {
                e.currentTarget.setPointerCapture(e.pointerId);
                const start = e.clientX,
                  initial = width;
                const move = (ev: PointerEvent) =>
                  setWidth(
                    Math.min(380, Math.max(260, initial + ev.clientX - start)),
                  );
                const end = () => {
                  window.removeEventListener("pointermove", move);
                  window.removeEventListener("pointerup", end);
                };
                window.addEventListener("pointermove", move);
                window.addEventListener("pointerup", end);
              }}
            />
          </>
        )}
        <main
          className={`workspace fade-switch ${modePhase} ${!sidebar ? "sidebar-collapsed" : ""}`}
        >
          {!sidebar && (
            <button
              className="restore-sidebar icon-button"
              title="Expand sidebar"
              onClick={() => setSidebar(true)}
            >
              <PanelLeftOpen />
            </button>
          )}
          {mode === "Changes" ? (
            <>
              <div className="workspace-label">
                <span>
                  <span className="status-dot" /> Working changes
                </span>
                <span>Review. Stage. Commit.</span>
              </div>
              {diff()}
              <section className={`composer ${collapsed ? "collapsed" : ""}`}>
                <div className="composer-heading">
                  <button
                    className="text-button"
                    onClick={() => setCollapsed(!collapsed)}
                  >
                    <GitCommitHorizontal size={17} />
                    <strong>Commit changes</strong>
                    {collapsed ? (
                      <ChevronUp size={14} />
                    ) : (
                      <ChevronDown size={14} />
                    )}
                  </button>
                  <span>
                    <b>{staged.length}</b> files staged{" "}
                    <span className="muted">on</span> <GitBranch size={12} />{" "}
                    {branch}
                  </span>
                </div>
                {!collapsed && (
                  <div className="composer-fields">
                    <input
                      aria-label="Commit title"
                      maxLength={120}
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      placeholder="A short, meaningful summary…"
                    />
                    <textarea
                      aria-label="Commit description"
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      placeholder="Add a description (optional)"
                    />
                  </div>
                )}
                <div className="composer-bottom">
                  {collapsed ? (
                    <input
                      className="compact-title"
                      aria-label="Commit title"
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      placeholder="Commit summary…"
                    />
                  ) : (
                    <span className="composer-hint">
                      <span className="avatar tiny">AM</span> Alex Morgan{" "}
                      <span className="muted">· Local commit</span>
                    </span>
                  )}
                  <button
                    className="button primary commit-submit"
                    disabled={!title.trim() || !staged.length}
                    onClick={commit}
                  >
                    <GitCommitHorizontal size={16} />
                    Commit {staged.length}{" "}
                    {staged.length === 1 ? "file" : "files"}
                    <span>↵</span>
                  </button>
                </div>
              </section>
            </>
          ) : mode === "History" || mode === "Stashes" ? (
            <>
              {mode === "History" && !commits.length ? (
                <div className="empty">
                  <GitCommitHorizontal />
                  <h2>No commits yet</h2>
                  <p>Your first commit will appear here.</p>
                </div>
              ) : mode === "Stashes" && !stashes.length ? (
                <div className="empty">
                  <Archive />
                  <h2>No stashes</h2>
                  <p>Your saved work will appear here.</p>
                </div>
              ) : (
                <>
                  <div className="detail-header">
                    <div className="eyebrow">
                      {mode === "History"
                        ? "COMMIT DETAILS"
                        : `stash@{${stashIndex}}`}
                    </div>
                    <h2>
                      {mode === "History"
                        ? commits[commitIndex]?.[0]
                        : stashes[stashIndex]}
                    </h2>
                    <div className="metadata">
                      {mode === "History" ? (
                        <>
                          <span className="avatar tiny">
                            {commits[commitIndex]?.[1] === "You"
                              ? "AM"
                              : commits[commitIndex]?.[1]
                                  .split(" ")
                                  .map((x) => x[0])
                                  .join("")}
                          </span>
                          {commits[commitIndex]?.[1]}
                          <span>· {commits[commitIndex]?.[2]}</span>
                          <code>{commits[commitIndex]?.[3]}</code>
                          <button
                            className="icon-button"
                            title="Copy SHA"
                            onClick={() =>
                              navigator.clipboard
                                .writeText(commits[commitIndex]?.[3])
                                .then(() => notify("SHA copied"))
                                .catch(() => notify("Clipboard unavailable"))
                            }
                          >
                            <Copy size={13} />
                          </button>
                          <span>
                            Parent {commits[commitIndex + 1]?.[3] || "—"}
                          </span>
                        </>
                      ) : (
                        <>
                          <GitBranch size={14} />
                          {branch}
                          <span>· Saved locally</span>
                        </>
                      )}
                    </div>
                    {mode === "History" &&
                      savedDescriptions[commits[commitIndex]?.[3]] && (
                        <p className="commit-description">
                          {savedDescriptions[commits[commitIndex]?.[3]]}
                        </p>
                      )}
                    <div className="detail-actions">
                      {(mode === "History"
                        ? ["Checkout", "Cherry-pick", "Revert"]
                        : [
                            "Apply stash",
                            "Pop stash",
                            "Drop stash",
                            "New branch",
                          ]
                      ).map((action) => (
                        <button
                          className={`button ${action === "Drop stash" ? "danger-text" : ""}`}
                          key={action}
                          onClick={() => operation(action)}
                        >
                          {action}
                        </button>
                      ))}
                    </div>
                  </div>
                  <CommitFiles
                    key={
                      mode === "History"
                        ? commits[commitIndex]?.[3]
                        : `stash-${stashIndex}`
                    }
                    files={inspectedFiles}
                    selected={current?.id}
                    onSelect={setReadFile}
                  >
                    {diff()}
                  </CommitFiles>
                </>
              )}
            </>
          ) : (
            <div className="branch-workspace">
              <div className="eyebrow">BRANCH OVERVIEW</div>
              <div className="branch-heading">
                <div className="branch-symbol">
                  <GitBranch size={25} />
                </div>
                <div>
                  <h2>{chosenBranch}</h2>
                  <p>
                    {chosenBranch === branch ? (
                      <>
                        <span className="status-dot" />
                        Current branch
                      </>
                    ) : (
                      "Local reference"
                    )}{" "}
                    <span className="muted">
                      · Last activity 12 minutes ago
                    </span>
                  </p>
                </div>
              </div>
              <div className="branch-actions">
                {["Switch branch", "Push", "Merge", "Rebase"].map((action) => (
                  <button
                    className={`button ${action === "Switch branch" ? "primary" : ""}`}
                    disabled={
                      action === "Switch branch" &&
                      (chosenBranch === branch ||
                        !branches.includes(chosenBranch))
                    }
                    key={action}
                    onClick={() => operation(action)}
                  >
                    {action === "Switch branch" ? (
                      <GitBranch size={14} />
                    ) : null}
                    {action}
                    {["Merge", "Rebase"].includes(action) ? "…" : ""}
                  </button>
                ))}
              </div>
              <div className="branch-card">
                <div className="branch-card-title">
                  <strong>Compared to main</strong>
                  <span className="tag">origin</span>
                </div>
                <div className="divergence">
                  <div>
                    <ArrowUp />
                    <strong>{chosenBranch === "main" ? 0 : 3}</strong>
                    <span>commits ahead</span>
                  </div>
                  <div>
                    <ArrowDown />
                    <strong>{chosenBranch === "main" ? 0 : 1}</strong>
                    <span>commit behind</span>
                  </div>
                </div>
                <div className="branch-diagram precise-diagram">
                  <svg
                    viewBox="0 0 560 100"
                    role="img"
                    aria-label={`main and ${chosenBranch} diverge from a shared commit`}
                  >
                    <path className="main-track" d="M20 25H132" />
                    <path
                      className="feature-track"
                      d="M20 25V47Q20 70 44 70H188"
                    />
                    {[20, 76, 132].map((x) => (
                      <circle
                        className="main-node"
                        key={x}
                        cx={x}
                        cy="25"
                        r="4"
                      />
                    ))}
                    {[76, 132, 188].map((x) => (
                      <circle
                        className="feature-node"
                        key={x}
                        cx={x}
                        cy="70"
                        r="4"
                      />
                    ))}
                    <text x="240" y="29">
                      main
                    </text>
                    <text className="feature-label" x="240" y="74">
                      {chosenBranch.length > 43
                        ? chosenBranch.slice(0, 40) + "…"
                        : chosenBranch}
                    </text>
                  </svg>
                </div>
                <div className="card-note">
                  Changes stay on their branch. Operations happen only when you
                  choose.
                </div>
              </div>
              <div className="recent-heading">
                <h3>Recent commits</h3>
                <button
                  className="text-button"
                  onClick={() => selectMode("History")}
                >
                  View history <ArrowRight size={14} />
                </button>
              </div>
              {commits.slice(0, 3).map((c) => (
                <div className="recent-commit" key={c[3]}>
                  <GitCommitHorizontal />
                  <div>
                    <strong>{c[0]}</strong>
                    <small>
                      {c[1]} · {c[2]}
                    </small>
                  </div>
                  <code>{c[3]}</code>
                </div>
              ))}
            </div>
          )}
        </main>
      </div>
      <footer className="statusbar">
        <span>
          <FolderGit2 size={12} /> {repo} <ChevronRight size={11} />{" "}
          <GitBranch size={12} />
          {branch}
        </span>
        <span>
          <span className="status-dot" /> All operations are simulated{" "}
          <span className="footer-divider">|</span> UTF-8{" "}
          <span className="footer-divider">|</span>
          <button onClick={() => setModal("Shortcuts")}>
            <Command size={12} /> Shortcuts
          </button>
        </span>
      </footer>
      {setup && (
        <RepositorySetup
          initialMode={setup}
          repositories={repositories}
          onCancel={() => setSetup(null)}
          onComplete={(r) => {
            setSetup(null);
            onAdd(r);
          }}
        />
      )}
      {toast && (
        <div className="toast">
          <CheckCircle2 size={16} />
          {toast}
          <button className="icon-button" onClick={() => setToast("")}>
            <X size={14} />
          </button>
        </div>
      )}
      {modal === "Pull requests" && (
        <PullRequests onClose={() => setModal("")} />
      )}
      {modal && modal !== "Pull requests" && (
        <div className="modal-overlay" onClick={() => setModal("")}>
          <section
            className="modal"
            role="dialog"
            aria-modal="true"
            aria-label={modal}
            onClick={(e) => e.stopPropagation()}
          >
            <button
              className="modal-close icon-button"
              aria-label="Close dialog"
              onClick={() => setModal("")}
            >
              <X />
            </button>
            <div className="eyebrow">
              {modal === "Settings"
                ? "PERSONALIZE YOUR WORKSPACE"
                : modal === "Shortcuts"
                  ? "QUICK REFERENCE"
                  : "GIT OPERATION PREVIEW"}
            </div>
            <h2>{modal}</h2>
            {modal === "Settings" ? (
              <>
                <p>Choose the appearance that works for you.</p>
                <div className="theme-options">
                  <button
                    className={`button ${!dark ? "primary" : ""}`}
                    onClick={() => setDark(false)}
                  >
                    <Sun />
                    Light
                  </button>
                  <button
                    className={`button ${dark ? "primary" : ""}`}
                    onClick={() => setDark(true)}
                  >
                    <Moon />
                    Dark
                  </button>
                </div>
                <p className="muted">Rivet 0.1 · Interactive UI prototype</p>
              </>
            ) : modal === "Shortcuts" ? (
              <>
                <p>
                  Use Tab to navigate, Enter to activate buttons, and Space to
                  toggle focused controls.
                </p>
                <p>
                  Drag the sidebar edge to resize. Use the panel icon to
                  collapse it.
                </p>
              </>
            ) : (
              <>
                <p>
                  {modal === "Rebase"
                    ? `Replay commits from ${branch} onto ${chosenBranch}. Commit identifiers will change.`
                    : modal === "Merge"
                      ? `Merge ${chosenBranch} into your current branch, ${branch}.`
                      : modal === "Switch branch"
                        ? `Switch from ${branch} to ${chosenBranch}.`
                        : modal === "Pull"
                          ? `Receive ${incoming} commits from origin/${branch}. ${ahead ? "Local and remote history have diverged. This preview uses an explicit merge; it will not rebase your commits." : "Your local branch will advance to include these commits."} Working changes remain in place in this demo.`
                          : modal === "Push"
                            ? `Push ${ahead} local commits from ${branch} to origin.`
                            : modal === "New branch"
                              ? "Create a local branch from the selected reference. The current branch will stay active."
                              : modal.includes("stash")
                                ? `${modal} for stash@{${stashIndex}}: ${stashes[stashIndex]}.`
                                : modal === "Discard file"
                                  ? `Remove all changes to ${current?.name} from this demo.`
                                  : `Preview ${modal.toLowerCase()} for commit ${commits[commitIndex]?.[3]}.`}
                </p>
                {modal === "New branch" && (
                  <input
                    autoFocus
                    aria-label="New branch name"
                    placeholder="feature/branch-name"
                    value={newBranch}
                    onChange={(e) =>
                      setNewBranch(
                        e.target.value.replace(/[^a-zA-Z0-9/_-]/g, ""),
                      )
                    }
                  />
                )}
                <div className="preview-note">
                  <CircleDot size={17} />
                  <span>
                    This is a demo operation. Your actual repository will not be
                    modified.
                  </span>
                </div>
                <button
                  className="text-button"
                  onClick={() => setDetails(!details)}
                >
                  {details ? <ChevronDown /> : <ChevronRight />}Show Git details
                </button>
                {details && (
                  <pre>
                    git{" "}
                    {modal === "Rebase"
                      ? `rebase ${chosenBranch}`
                      : modal === "Merge"
                        ? `merge ${chosenBranch}`
                        : modal === "Pull"
                          ? `pull --no-rebase origin ${branch}`
                          : modal === "Push"
                            ? `push origin ${branch}`
                            : modal === "Switch branch"
                              ? `switch ${chosenBranch}`
                              : modal === "New branch"
                                ? `branch ${newBranch || "<name>"}`
                                : modal.includes("stash")
                                  ? `stash ${modal.split(" ")[0].toLowerCase()} stash@{${stashIndex}}`
                                  : modal === "Discard file"
                                    ? `restore -- ${current?.path}/${current?.name}`
                                    : `${modal.toLowerCase()} ${commits[commitIndex]?.[3]}`}
                  </pre>
                )}
                <div className="modal-actions">
                  <button className="button" onClick={() => setModal("")}>
                    Cancel
                  </button>
                  <button
                    className={`button ${modal === "Drop stash" || modal === "Discard file" ? "danger" : "primary"}`}
                    disabled={
                      modal === "New branch" &&
                      (!newBranch.trim() || branches.includes(newBranch.trim()))
                    }
                    onClick={perform}
                  >
                    {modal === "New branch"
                      ? "Create branch"
                      : [
                            "Merge",
                            "Rebase",
                            "Apply stash",
                            "Checkout",
                            "Cherry-pick",
                            "Revert",
                          ].includes(modal)
                        ? "Confirm preview"
                        : modal}
                  </button>
                </div>
              </>
            )}
          </section>
        </div>
      )}
    </div>
  );
}
function App() {
  const [repositories, setRepositories] = useState<Repository[]>(() => {
    try {
      const stored = JSON.parse(
        localStorage.getItem("rivet.repositories") || "null",
      );
      if (
        Array.isArray(stored) &&
        stored.length &&
        stored.every(
          (r) =>
            typeof r.id === "string" &&
            typeof r.name === "string" &&
            typeof r.path === "string" &&
            ["demo", "open", "clone", "create"].includes(r.kind),
        )
      )
        return stored;
    } catch {}
    return [
      {
        id: "kinetic",
        name: "kinetic",
        path: "D:/Projects/kinetic",
        kind: "demo",
      },
      {
        id: "kinetic-sandbox",
        name: "kinetic-sandbox",
        path: "D:/Projects/kinetic-sandbox",
        kind: "demo",
      },
    ];
  });
  const [active, setActive] = useState(repositories[0].id),
    [dark, setDark] = useState(false);
  const add = (r: Repository) => {
    const next = [...repositories, r];
    setRepositories(next);
    setActive(r.id);
    try {
      localStorage.setItem("rivet.repositories", JSON.stringify(next));
    } catch {}
  };
  return (
    <>
      {repositories.map((r) => (
        <div key={r.id} hidden={r.id !== active}>
          <Workspace
            repository={r}
            repositories={repositories}
            onSwitch={setActive}
            onAdd={add}
            dark={dark}
            setDark={setDark}
          />
        </div>
      ))}
    </>
  );
}
createRoot(document.getElementById("root")!).render(<App />);
