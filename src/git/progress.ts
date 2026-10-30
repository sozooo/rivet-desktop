/**
 * Progress of long git commands. git redraws lines such as
 * "Receiving objects:  42% (130/309), 1.20 MiB | 1.10 MiB/s" on stderr, ending
 * each with \r; git-lfs appends "download 3/10 1048576/4194304 Art/Tex.psd" to
 * the file named by GIT_LFS_PROGRESS. Runners pass both along line by line and
 * a ProgressTracker turns them into one report for the UI.
 */

/**
 * prepare: counting and compressing objects, here or on the server;
 * receive / send: commits and file versions coming in or going out;
 * resolve: unpacking what came in; checkout: writing files into the folder;
 * download / upload: Git LFS files.
 */
export type ProgressPhase =
  | "prepare"
  | "receive"
  | "resolve"
  | "checkout"
  | "send"
  | "download"
  | "upload";

export type GitProgress = {
  phase: ProgressPhase;
  /**
   * 0–100, or null while git only counts. git's own phases share the command's
   * 100 (receiving is most of a clone); an LFS transfer counts on its own.
   */
  percent: number | null;
  /** LFS transfers: files finished out of all of them. */
  files?: { done: number; total: number };
  /** LFS transfers: bytes so far, and the total once every file's size is known. */
  bytes?: { done: number; total: number | null };
};

export type ProgressListener = (progress: GitProgress) => void;

/** git's own stderr, or the lines git-lfs appends to its progress file. */
export type ProgressSource = "git" | "lfs";

/** Commands whose progress is shown; each spreads git's phases differently. */
export type ProgressCommand = "clone" | "fetch" | "pull" | "push" | "lfs";

/** One of git's progress lines, e.g. "remote: Counting objects:  42% (130/309)". */
export type GitLine = {
  title: string;
  /** Counted on the server ("remote: …"). */
  remote: boolean;
  percent: number | null;
  count: number;
  total: number | null;
  /** Bytes so far, when the line says ("1.20 MiB"). */
  bytes: number | null;
};

const UNITS: Record<string, number> = {
  bytes: 1,
  B: 1,
  KiB: 1024,
  MiB: 1024 ** 2,
  GiB: 1024 ** 3,
  TiB: 1024 ** 4,
  KB: 1e3,
  MB: 1e6,
  GB: 1e9,
  TB: 1e12,
};

const GIT_LINE =
  /^(remote: )?([A-Za-z][A-Za-z ]*?):\s+(?:(\d{1,3})% \((\d+)\/(\d+)\)|(\d+))(?:,\s+([\d.]+) (bytes|B|[KMGT]i?B))?/;

export function parseGitLine(text: string): GitLine | null {
  const match = text.trim().match(GIT_LINE);
  if (!match) return null;
  const [, remote, title, percent, count, total, counted, size, unit] = match;
  return {
    title,
    remote: !!remote,
    percent: percent === undefined ? null : Number(percent),
    count: Number(count ?? counted),
    total: total === undefined ? null : Number(total),
    bytes: size === undefined ? null : Math.round(Number(size) * UNITS[unit]),
  };
}

/** One line git-lfs wrote to GIT_LFS_PROGRESS: direction, file number, bytes and path. */
export type LfsLine = {
  /** "download" and "upload" are transfers; "clean" and "checkout" are local. */
  direction: string;
  index: number;
  /** How many files git-lfs expects so far; it can grow while it looks. */
  estimated: number;
  read: number;
  total: number;
  name: string;
};

const LFS_LINE = /^(\w+) (\d+)\/(\d+) (\d+)\/(\d+) (.+)$/;

export function parseLfsLine(text: string): LfsLine | null {
  const match = text.replace(/\r?\n?$/, "").match(LFS_LINE);
  if (!match) return null;
  const [, direction, index, estimated, read, total, name] = match;
  return {
    direction,
    index: Number(index),
    estimated: Number(estimated),
    read: Number(read),
    total: Number(total),
    name,
  };
}

/** git's progress titles, in English: Git for Windows and MinGit don't translate. */
const PHASES: Record<string, ProgressPhase> = {
  "Enumerating objects": "prepare",
  "Counting objects": "prepare",
  "Compressing objects": "prepare",
  "Receiving objects": "receive",
  "Unpacking objects": "receive",
  "Resolving deltas": "resolve",
  "Checking connectivity": "resolve",
  "Updating files": "checkout",
  "Checking out files": "checkout",
  "Writing objects": "send",
  // git's delayed checkout: Git LFS downloading files during a pull.
  "Filtering content": "download",
  // git-lfs's own summary.
  "Downloading LFS objects": "download",
  "Uploading LFS objects": "upload",
};

/** Where each of git's phases sits in a command's 0–100; others don't count. */
const SHARES: Record<
  ProgressCommand,
  Partial<Record<ProgressPhase, [number, number]>>
> = {
  clone: {
    prepare: [0, 5],
    receive: [5, 80],
    resolve: [80, 90],
    checkout: [90, 100],
  },
  fetch: { prepare: [0, 10], receive: [10, 85], resolve: [85, 100] },
  pull: {
    prepare: [0, 5],
    receive: [5, 75],
    resolve: [75, 85],
    checkout: [85, 100],
  },
  push: { prepare: [0, 10], send: [10, 100] },
  lfs: {},
};

type Transfer = {
  direction: "download" | "upload";
  files: Map<string, { read: number; total: number }>;
  estimated: number;
  /** From git's "Filtering content" line: files and bytes, but no sizes ahead. */
  filtered?: { done: number; total: number; bytes: number };
  percent: number;
  /** git went on to something else; late lines from the file no longer show. */
  over: boolean;
};

const sum = (values: number[]) => values.reduce((a, b) => a + b, 0);

/** Equal as far as the UI can tell: same phase, percent, files and tenth of a megabyte. */
function same(a: GitProgress, b: GitProgress | null) {
  const tenths = (bytes?: number | null) =>
    bytes == null ? bytes : Math.floor(bytes / 104_857.6);
  return (
    !!b &&
    a.phase === b.phase &&
    a.percent === b.percent &&
    a.files?.done === b.files?.done &&
    a.files?.total === b.files?.total &&
    tenths(a.bytes?.done) === tenths(b.bytes?.done) &&
    tenths(a.bytes?.total) === tenths(b.bytes?.total)
  );
}

/**
 * Follows one command (or a clone's two) through its progress lines. Reports
 * only go up within a phase, and lines that change nothing visible report nothing.
 */
export class ProgressTracker {
  private shown: GitProgress | null = null;
  private gitPercent = 0;
  private transfer?: Transfer;

  constructor(
    private command: ProgressCommand,
    /** What an LFS download will fetch, when known ahead (from `git lfs ls-files`). */
    private expected?: { files: number; bytes: number },
  ) {}

  /** Takes one line; returns the new progress when what the UI shows changed. */
  line(source: ProgressSource, text: string): GitProgress | null {
    const next = source === "lfs" ? this.lfsLine(text) : this.gitLine(text);
    if (!next || same(next, this.shown)) return null;
    this.shown = next;
    return next;
  }

  /** Sizes for the LFS download that comes next, once they are known. */
  expect(expected: { files: number; bytes: number }) {
    this.expected = expected;
  }

  private gitLine(text: string): GitProgress | null {
    const line = parseGitLine(text);
    const phase = line && PHASES[line.title];
    if (!line || !phase) return null;
    if (phase === "download" || phase === "upload") {
      // Only "Filtering content" has numbers git-lfs's file doesn't.
      if (line.title !== "Filtering content" || line.total === null)
        return null;
      const transfer = this.transferFor(phase);
      transfer.filtered = {
        done: line.count,
        total: line.total,
        bytes: line.bytes ?? 0,
      };
      return this.transferProgress(transfer);
    }
    const share = SHARES[this.command][phase];
    if (!share) return null;
    if (this.transfer) this.transfer.over = true;
    const [from, to] = share;
    const within = ((to - from) * (line.percent ?? 0)) / 100;
    this.gitPercent = Math.max(this.gitPercent, from + within);
    return {
      phase,
      // Only counting so far: nothing to show as a number yet.
      percent:
        line.percent === null && !this.gitPercent
          ? null
          : Math.floor(this.gitPercent),
    };
  }

  private lfsLine(text: string): GitProgress | null {
    const line = parseLfsLine(text);
    if (!line || (line.direction !== "download" && line.direction !== "upload"))
      return null;
    const transfer = this.transferFor(line.direction);
    transfer.files.set(line.name, { read: line.read, total: line.total });
    transfer.estimated = Math.max(transfer.estimated, line.estimated);
    const progress = this.transferProgress(transfer);
    return transfer.over ? null : progress;
  }

  private transferFor(direction: Transfer["direction"]) {
    if (this.transfer?.direction !== direction)
      this.transfer = {
        direction,
        files: new Map(),
        estimated: 0,
        percent: 0,
        over: false,
      };
    return this.transfer;
  }

  private transferProgress(transfer: Transfer): GitProgress {
    const known = [...transfer.files.values()];
    const { filtered } = transfer;
    const expected = transfer.direction === "download" ? this.expected : null;
    const total = Math.max(
      expected?.files ?? 0,
      transfer.estimated,
      known.length,
      filtered?.total ?? 0,
    );
    const done = Math.max(
      known.filter((f) => f.read >= f.total).length,
      filtered?.done ?? 0,
    );
    const read = Math.max(sum(known.map((f) => f.read)), filtered?.bytes ?? 0);
    // Sizes are known ahead, or once every file has started.
    const size =
      expected?.bytes ||
      (total && known.length >= total ? sum(known.map((f) => f.total)) : null);
    const fraction = size
      ? read / size
      : total
        ? Math.max(
            sum(known.map((f) => (f.total ? f.read / f.total : 1))) / total,
            filtered ? filtered.done / filtered.total : 0,
          )
        : 0;
    transfer.percent = Math.max(
      transfer.percent,
      Math.min(100, Math.floor(fraction * 100)),
    );
    return {
      phase: transfer.direction,
      percent: transfer.percent,
      files: { done, total },
      bytes: { done: read, total: size },
    };
  }
}

const NOISE = [
  /^(remote: )?Total \d+ \(delta \d+\)/,
  /^Delta compression using up to \d+ threads/,
];

/** git's error output without the progress lines a --progress run adds to it. */
export function withoutProgress(stderr: string) {
  return stderr
    .split("\n")
    .filter((raw) => {
      const text = raw.trim();
      const line = parseGitLine(text);
      if (line && (line.remote || line.title in PHASES)) return false;
      return !NOISE.some((pattern) => pattern.test(text));
    })
    .join("\n")
    .trim();
}
