import type { Commit, DiffLine, FileStatus, StashEntry } from "../types";

// ---------------------------------------------------------------------------
// git status --porcelain=v2 -z --branch

export type StatusEntry = {
  path: string;
  oldPath?: string;
  /** Index (staged) and worktree status letters; "." means unchanged. */
  index: string;
  worktree: string;
  untracked: boolean;
  conflicted: boolean;
  /** For conflicts: whether "ours" (stage 2) and "theirs" (stage 3) have the file. */
  stages?: { ours: boolean; theirs: boolean };
};

export type Status = {
  head: string;
  oid: string | null;
  upstream: string | null;
  ahead: number;
  behind: number;
  entries: StatusEntry[];
};

export function parseStatus(output: string): Status {
  const status: Status = {
    head: "",
    oid: null,
    upstream: null,
    ahead: 0,
    behind: 0,
    entries: [],
  };
  const records = output.split("\0");
  for (let i = 0; i < records.length; i++) {
    const record = records[i];
    if (!record) continue;
    if (record.startsWith("# ")) {
      const [key, ...rest] = record.slice(2).split(" ");
      const value = rest.join(" ");
      if (key === "branch.head") status.head = value;
      else if (key === "branch.oid")
        status.oid = value === "(initial)" ? null : value;
      else if (key === "branch.upstream") status.upstream = value;
      else if (key === "branch.ab") {
        const match = value.match(/\+(\d+) -(\d+)/);
        if (match) [status.ahead, status.behind] = [+match[1], +match[2]];
      }
      continue;
    }
    const kind = record[0];
    if (kind === "?") {
      status.entries.push({
        path: record.slice(2),
        index: "?",
        worktree: "?",
        untracked: true,
        conflicted: false,
      });
    } else if (kind === "1" || kind === "2" || kind === "u") {
      // Fields before the path: 1 → 8, 2 → 9 (adds the rename score), u → 10.
      const fields = kind === "1" ? 8 : kind === "2" ? 9 : 10;
      const parts = record.split(" ");
      const xy = parts[1];
      const entry: StatusEntry = {
        path: parts.slice(fields).join(" "),
        index: xy[0],
        worktree: xy[1],
        untracked: false,
        conflicted: kind === "u",
      };
      // "u XY sub m1 m2 m3 mW …": a stage's mode is 000000 when that side has no file.
      if (kind === "u")
        entry.stages = {
          ours: parts[4] !== "000000",
          theirs: parts[5] !== "000000",
        };
      // A rename's original path follows as its own NUL-separated record.
      if (kind === "2") entry.oldPath = records[++i];
      status.entries.push(entry);
    }
  }
  return status;
}

export function fileStatus(entry: StatusEntry): FileStatus {
  if (entry.oldPath) return "renamed";
  if (entry.untracked || entry.index === "A") return "added";
  if (entry.index === "D" || entry.worktree === "D") return "deleted";
  return "modified";
}

// ---------------------------------------------------------------------------
// Unified diffs

export type RawHunk = { header: string; lines: DiffLine[]; text: string };

export type FileDiff = {
  path: string;
  oldPath?: string;
  status: FileStatus;
  binary: boolean;
  /** Everything before the first hunk; with one hunk's text it forms a patch git can apply. */
  patchHeader: string;
  hunks: RawHunk[];
};

/** Undoes git's C-style quoting of unusual paths: "a\"b\303\251" → a"bé. */
export function unquotePath(path: string): string {
  if (!path.startsWith('"')) return path;
  const bytes: number[] = [];
  const body = path.slice(1, -1);
  const escapes: Record<string, number> = {
    n: 10,
    t: 9,
    r: 13,
    '"': 34,
    "\\": 92,
    a: 7,
    b: 8,
    f: 12,
    v: 11,
  };
  for (let i = 0; i < body.length; i++) {
    if (body[i] !== "\\") {
      bytes.push(...new TextEncoder().encode(body[i]));
      continue;
    }
    const next = body[++i];
    if (/[0-7]/.test(next)) {
      bytes.push(parseInt(body.slice(i, i + 3), 8));
      i += 2;
    } else bytes.push(escapes[next] ?? next.charCodeAt(0));
  }
  return new TextDecoder().decode(new Uint8Array(bytes));
}

/** Reads the path from "diff --git a/X b/X" when the file was not renamed. */
function samePathFromHeader(line: string): string {
  const rest = line.slice("diff --git ".length);
  if (rest.startsWith('"')) {
    const end = rest.indexOf('" ');
    return unquotePath(rest.slice(0, end + 1)).replace(/^a\//, "");
  }
  // "a/<p> b/<p>": both halves have the same length.
  const half = (rest.length - 1) / 2;
  return rest.slice(2, half);
}

// Git ends "--- a/x y" and "+++ b/x y" with a tab when the name has a space.
const stripPrefix = (path: string) =>
  unquotePath(path.replace(/\t$/, "")).replace(/^[ab]\//, "");

export function parseDiff(output: string): FileDiff[] {
  const files: FileDiff[] = [];
  const lines = output.split("\n");
  let file: FileDiff | null = null;
  let hunk: RawHunk | null = null;
  let headerLines: string[] = [];

  for (const raw of lines) {
    const line = raw.endsWith("\r") ? raw.slice(0, -1) : raw;
    // Combined diffs of conflicted files ("diff --cc") can't be applied; skip them.
    if (line.startsWith("diff ") && !line.startsWith("diff --git ")) {
      file = null;
      hunk = null;
      continue;
    }
    if (line.startsWith("diff --git ")) {
      file = {
        path: samePathFromHeader(line),
        status: "modified",
        binary: false,
        patchHeader: "",
        hunks: [],
      };
      files.push(file);
      hunk = null;
      headerLines = [line];
      continue;
    }
    if (!file) continue;
    if (!hunk) {
      if (line.startsWith("@@")) {
        file.patchHeader = headerLines.join("\n") + "\n";
      } else {
        headerLines.push(line);
        if (line.startsWith("new file mode")) file.status = "added";
        else if (line.startsWith("deleted file mode")) file.status = "deleted";
        else if (line.startsWith("rename from ")) {
          file.oldPath = unquotePath(line.slice(12));
          file.status = "renamed";
        } else if (line.startsWith("rename to "))
          file.path = unquotePath(line.slice(10));
        else if (line.startsWith("+++ ") && line !== "+++ /dev/null")
          file.path = stripPrefix(line.slice(4));
        else if (
          line.startsWith("Binary files ") ||
          line === "GIT binary patch"
        )
          file.binary = true;
        continue;
      }
    }
    if (line.startsWith("@@")) {
      hunk = { header: line, lines: [], text: line + "\n" };
      file.hunks.push(hunk);
      continue;
    }
    if (!hunk) continue;
    const sign = line[0];
    if (sign === " " || sign === "+" || sign === "-") {
      hunk.lines.push({
        kind: sign === "+" ? "add" : sign === "-" ? "del" : "context",
        text: line.slice(1),
      });
      hunk.text += line + "\n";
    } else if (sign === "\\") {
      // "\ No newline at end of file" belongs in the patch but not in the view.
      hunk.text += line + "\n";
    }
  }
  return files;
}

/** A diff for a file git doesn't track yet, built from its contents. */
export function untrackedDiff(path: string, text: string): FileDiff {
  const body = text.replace(/\r\n/g, "\n").replace(/\n$/, "");
  const lines = body ? body.split("\n") : [];
  const header = `@@ -0,0 +1,${lines.length} @@`;
  return {
    path,
    status: "added",
    binary: false,
    patchHeader: "",
    hunks: lines.length
      ? [
          {
            header,
            lines: lines.map((l) => ({ kind: "add" as const, text: l })),
            text: "",
          },
        ]
      : [],
  };
}

/** True when bytes look like a binary file: a NUL byte near the start. */
export function looksBinary(bytes: Uint8Array) {
  return bytes.subarray(0, 8000).includes(0);
}

// ---------------------------------------------------------------------------
// git log

export const LOG_FORMAT = "%H%x00%P%x00%an%x00%ae%x00%at%x00%D%x00%s%x00%b%x1e";

export function parseLog(output: string, currentBranch: string): Commit[] {
  return output
    .split("\x1e")
    .map((record) => record.replace(/^\n/, ""))
    .filter(Boolean)
    .map((record) => {
      const [sha, parents, name, email, time, decorations, summary, body] =
        record.split("\0");
      const refs = decorations
        .split(", ")
        .filter(Boolean)
        .map((ref) => ref.replace(/^HEAD -> /, "").replace(/^tag: /, ""))
        .filter(
          (ref) =>
            ref !== "HEAD" && ref !== currentBranch && !ref.endsWith("/HEAD"),
        );
      return {
        sha,
        parents: parents ? parents.split(" ") : [],
        author: { name, email },
        date: Number(time) * 1000,
        summary,
        description: (body ?? "").trim(),
        refs: refs.length ? refs : undefined,
      };
    });
}

// ---------------------------------------------------------------------------
// refs and stashes

export function parseRefs(output: string) {
  const local: string[] = [],
    remote: string[] = [],
    tags: string[] = [];
  for (const ref of output.split("\n").filter(Boolean)) {
    if (ref.startsWith("refs/heads/")) local.push(ref.slice(11));
    else if (ref.startsWith("refs/remotes/") && !ref.endsWith("/HEAD"))
      remote.push(ref.slice(13));
    else if (ref.startsWith("refs/tags/")) tags.push(ref.slice(10));
  }
  return { local, remote, tags };
}

export const STASH_FORMAT = "%gd%x00%ct%x00%gs";

export function parseStashList(
  output: string,
): Omit<StashEntry, "fileCount">[] {
  return output
    .split("\n")
    .filter(Boolean)
    .map((line) => {
      const [ref, time, subject] = line.split("\0");
      // "On main: message" for named stashes, "WIP on main: <sha> <summary>" otherwise.
      const match = subject.match(/^(?:WIP on|On) ([^:]+): (.*)$/);
      return {
        index: Number(ref.match(/\{(\d+)\}/)?.[1] ?? 0),
        date: Number(time) * 1000,
        branch: match?.[1] ?? "",
        message: match?.[2] ?? subject,
      };
    });
}

// ---------------------------------------------------------------------------
// conflicts

/**
 * `git ls-files -s -z` and `--resolve-undo -z`: "<mode> <object> <stage>\t<path>".
 * Returns each path's objects by stage (0 for a resolved file, 1–3 for a conflict).
 */
export function parseStages(output: string) {
  const paths = new Map<string, Map<number, string>>();
  for (const record of output.split("\0")) {
    const match = record.match(/^\d+ ([0-9a-f]+) (\d)\t(.*)$/s);
    if (!match) continue;
    const [, object, stage, path] = match;
    if (!paths.has(path)) paths.set(path, new Map());
    paths.get(path)!.set(Number(stage), object);
  }
  return paths;
}

/** The files git listed under "# Conflicts:" when it wrote MERGE_MSG. */
export function conflictPaths(mergeMessage: string): string[] {
  const lines = mergeMessage.split(/\r?\n/);
  const start = lines.findIndex((l) => /^# Conflicts:$/.test(l));
  if (start === -1) return [];
  const paths: string[] = [];
  for (const line of lines.slice(start + 1)) {
    const match = line.match(/^#\t(.+)$/);
    if (!match) break;
    paths.push(match[1]);
  }
  return paths;
}

/** `git check-attr -z`: "<path>\0<attribute>\0<value>\0" triples. */
export function parseCheckAttr(output: string) {
  const parts = output.split("\0");
  const values = new Map<string, Record<string, string>>();
  for (let i = 0; i + 2 < parts.length; i += 3) {
    const [path, attribute, value] = parts.slice(i, i + 3);
    values.set(path, { ...values.get(path), [attribute]: value });
  }
  return values;
}

/**
 * `git cat-file --batch-check="%(objecttype) %(objectsize) %(rest)"` fed
 * "<object> <path>" lines: blobs larger than `limit`, with their paths.
 */
export function largeBlobs(output: string, limit: number) {
  const found = new Map<string, number>();
  for (const line of output.split("\n")) {
    const match = line.match(/^blob (\d+) (.+)$/);
    if (match && Number(match[1]) > limit)
      found.set(match[2], Math.max(Number(match[1]), found.get(match[2]) ?? 0));
  }
  return [...found].map(([path, size]) => ({ path, size }));
}
