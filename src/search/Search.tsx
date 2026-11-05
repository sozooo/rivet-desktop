import {
  useDeferredValue,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
  type ReactNode,
} from "react";
import {
  Check,
  Cloud,
  CornerDownLeft,
  GitBranch,
  GitCommitHorizontal,
  Search as SearchIcon,
  X,
} from "lucide-react";
import { localName, remoteOnly } from "../git/branches";
import { shortSha } from "../git/paths";
import { groupStatus, groupWithMeta } from "../git/unity";
import { useI18n, type Key } from "../i18n/i18n";
import { FileIcon, StatusIcon } from "../ui/FileIcon";
import type { RepoApi } from "../views/repoApi";
import { searchActions, type BranchPick } from "./actions";
import { useFileIndex } from "./fileIndex";
import {
  fileHighlights,
  fileSearch,
  indexedFile,
  queryWords,
  rankItems,
  strength,
  type FileHit,
  type IndexedFile,
} from "./rank";

/** How many results each group shows; the heading says how many there are. */
const LIMITS = { changed: 5, files: 8, versions: 5, branches: 5, actions: 5 };
/** Picking a branch lists them all, up to this many. */
const PICK_LIMIT = 60;

type GroupId = "changed" | "files" | "versions" | "branches" | "actions";
/** The usual order; a group with a clearly better match moves up. */
const ORDER: GroupId[] = [
  "changed",
  "files",
  "versions",
  "branches",
  "actions",
];
const GROUP_LABELS: Record<GroupId, Key> = {
  changed: "search.group.changed",
  files: "search.group.files",
  versions: "search.group.versions",
  branches: "search.group.branches",
  actions: "search.group.actions",
};

type Row = {
  key: string;
  icon: ReactNode;
  title: string;
  marks: number[];
  detail?: ReactNode;
  /** The detail is a folder: when too long, it loses its start. */
  folder?: boolean;
  /** At the row's end: a status, a sha, the current branch's tick. */
  note?: ReactNode;
  /** Why it can't be opened right now; the row says so instead of opening. */
  blocked?: string | null;
  /** Opens it with the workspace as it is by then, or picks a branch next. */
  open: ((repo: RepoApi) => void) | { pick: BranchPick };
};

type Group = {
  id: GroupId;
  rows: Row[];
  /** How many matched, of which `rows` are the best. */
  total: number;
  strength: number;
  /** Why the group's rows can't be opened right now. */
  note?: string;
};

/** Text with the matched characters marked. */
function Marked({ text, marks }: { text: string; marks: readonly number[] }) {
  if (!marks.length) return <>{text}</>;
  const marked = new Set(marks);
  const parts: ReactNode[] = [];
  for (let i = 0; i < text.length;) {
    const on = marked.has(i);
    let j = i;
    while (j < text.length && marked.has(j) === on) j++;
    parts.push(on ? <mark key={i}>{text.slice(i, j)}</mark> : text.slice(i, j));
    i = j;
  }
  return <>{parts}</>;
}

const folderOf = (file: IndexedFile) =>
  file.nameStart ? file.path.slice(0, file.nameStart - 1) : "";

/**
 * Search across the project (Ctrl+K): changed files, every file, versions,
 * branches and actions. Lives in the middle of the toolbar and opens a
 * results panel under itself; the keyboard does everything.
 */
export function Search({ repo }: { repo: RepoApi }) {
  const { t, mode, timeAgo, language } = useI18n();
  const { snapshot, blocked } = repo;
  const index = useFileIndex(repo.backend, snapshot);
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  /** Choosing a branch for this, instead of searching everything. */
  const [pick, setPick] = useState<BranchPick | null>(null);
  const typed = useDeferredValue(query);
  const input = useRef<HTMLInputElement>(null);
  const box = useRef<HTMLDivElement>(null);
  /** Where focus was before Ctrl+K: Esc goes back there. */
  const returnTo = useRef<HTMLElement | null>(null);
  /** Results act on the workspace as it is when chosen, not when listed. */
  const latest = useRef(repo);
  latest.current = repo;
  /** The keyboard moved the choice, so the list follows it. */
  const follow = useRef(false);
  /** Enter came before the results for the last keystroke did. */
  const entered = useRef(false);
  const listId = useId();
  const full = mode === "full";

  // Ctrl+K from anywhere, by the key's place so it works in Russian too.
  useEffect(() => {
    const onKey = (e: globalThis.KeyboardEvent) => {
      if (e.code !== "KeyK" || !(e.ctrlKey || e.metaKey) || e.altKey) return;
      // A dialog has the screen: search would open behind it.
      if (document.querySelector('[role="dialog"]')) return;
      e.preventDefault();
      if (document.activeElement !== input.current)
        returnTo.current = document.activeElement as HTMLElement | null;
      input.current?.focus();
      input.current?.select();
      setOpen(true);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // Opening asks again if listing the files failed before.
  useEffect(() => {
    if (open) index.ensure();
  }, [open]);

  const groups = useMemo((): Group[] => {
    if (!open) return [];
    const words = queryWords(typed);
    const branchList = [
      snapshot.branches.current,
      ...snapshot.branches.local.filter((b) => b !== snapshot.branches.current),
      ...remoteOnly(snapshot.branches),
    ].map(branchItem);
    function branchItem(name: string) {
      const server = !snapshot.branches.local.includes(name);
      return {
        name,
        server,
        current: name === snapshot.branches.current,
        label: full || !server ? name : localName(name),
      };
    }
    const branchRows = (limit: number) => {
      // Picking a branch to go to, merge or rebase onto: not the one you're on.
      const listed = pick ? branchList.filter((b) => !b.current) : branchList;
      const { hits, total } = rankItems(listed, words, (b) => [b.label], limit);
      const switching = !pick || pick === "switch";
      const rows = hits.map(({ item: b, positions }): Row => ({
        key: `branch:${b.name}`,
        icon: b.server ? <Cloud /> : <GitBranch />,
        title: b.label,
        marks: positions[0],
        detail: b.current
          ? t("search.branch.current")
          : b.server
            ? t("search.branch.server")
            : undefined,
        note: b.current && !pick ? <Check /> : undefined,
        blocked: switching && !b.current ? blocked : null,
        open:
          pick === "merge" || pick === "rebase"
            ? (r) => r.openOperation(pick, { target: b.name })
            : (r) => (b.current ? undefined : r.switchBranch(b.name)),
      }));
      return {
        rows,
        total,
        quality: hits[0]?.quality ?? 0,
        // Said once for the group rather than on every row.
        note: switching ? (blocked ?? undefined) : undefined,
      };
    };

    if (pick)
      return [{ id: "branches", ...branchRows(PICK_LIMIT), strength: 0 }];

    const result: (Group & { quality: number })[] = [];
    const add = (
      id: GroupId,
      found: { rows: Row[]; total: number; quality: number; note?: string },
    ) => {
      if (found.rows.length)
        result.push({ id, ...found, strength: strength(found.quality) });
    };

    // Changed files: an asset and its .meta file are one row, as in Changes.
    const changed = groupWithMeta(snapshot.files);
    const changedFiles = changed.map((g) => indexedFile(g.path));
    const status = new Map(changed.map((g) => [g.path, groupStatus(g)]));
    const fileRow = (hit: FileHit, kind: "changed" | "file"): Row => {
      const { file } = hit;
      const marks = words.length
        ? fileHighlights(words, file)
        : { name: [], folder: [] };
      const folder = folderOf(file);
      const state = kind === "changed" ? status.get(file.path) : undefined;
      return {
        key: `${kind}:${file.path}`,
        icon: <FileIcon path={file.path} />,
        title: file.path.slice(file.nameStart),
        marks: marks.name,
        detail: folder ? (
          <bdi>
            <Marked text={folder} marks={marks.folder} />
          </bdi>
        ) : (
          t("common.repositoryRoot")
        ),
        folder: !!folder,
        note: state ? (
          <StatusIcon status={state} word />
        ) : file.deleted ? (
          <StatusIcon status="deleted" word />
        ) : undefined,
        open: (r) =>
          kind === "changed"
            ? r.showChanges(file.path)
            : r.showFileHistory(file.path),
      };
    };
    const quality = (hits: FileHit[]) =>
      Math.max(0, ...hits.map((h) => h.quality));
    if (words.length) {
      const found = fileSearch(changedFiles)(words, LIMITS.changed);
      add("changed", {
        rows: found.hits.map((h) => fileRow(h, "changed")),
        total: found.total,
        quality: quality(found.hits),
      });
    } else
      add("changed", {
        rows: changedFiles
          .slice(0, LIMITS.changed)
          .map((file) =>
            fileRow({ file, score: 0, quality: 0, inName: true }, "changed"),
          ),
        total: changedFiles.length,
        quality: 0,
      });

    if (words.length && index.search) {
      // What is listed above already is not repeated.
      const shown = new Set(snapshot.files.map((f) => f.path));
      for (const g of changed) shown.add(g.path);
      const found = index.search(words, LIMITS.files, (f) => shown.has(f.path));
      add("files", {
        rows: found.hits.map((h) => fileRow(h, "file")),
        total: found.total,
        quality: quality(found.hits),
      });
    }

    if (words.length) {
      const { hits, total } = rankItems(
        snapshot.commits,
        words,
        (c) => [c.summary, c.author.name],
        LIMITS.versions,
        full
          ? (c, word) => word.length >= 4 && c.sha.startsWith(word)
          : undefined,
      );
      add("versions", {
        rows: hits.map(({ item: c, positions }) => ({
          key: `commit:${c.sha}`,
          icon: <GitCommitHorizontal />,
          title: c.summary,
          marks: positions[0],
          detail: (
            <>
              <Marked text={c.author.name} marks={positions[1]} /> ·{" "}
              {timeAgo(c.date)}
            </>
          ),
          note: full ? <code>{shortSha(c.sha)}</code> : undefined,
          open: (r) => r.showCommit(c.sha),
        })),
        total,
        quality: Math.max(0, ...hits.map((h) => h.quality)),
      });
      add("branches", branchRows(LIMITS.branches));
    }

    const actions = searchActions({ snapshot, blocked }, mode, t);
    const ranked = rankItems(
      actions,
      words,
      (a) => [a.label, a.keywords],
      words.length ? LIMITS.actions : actions.length,
    );
    add("actions", {
      rows: ranked.hits.map(({ item: a, positions }) => ({
        key: `action:${a.id}`,
        icon: <a.Icon />,
        title: a.label,
        marks: positions[0],
        detail: a.blocked ?? undefined,
        blocked: a.blocked,
        open: a.run,
      })),
      total: ranked.total,
      quality: Math.max(0, ...ranked.hits.map((h) => h.quality)),
    });

    return result.sort(
      (a, b) =>
        b.strength - a.strength || ORDER.indexOf(a.id) - ORDER.indexOf(b.id),
    );
  }, [
    open,
    typed,
    pick,
    snapshot,
    blocked,
    index.search,
    mode,
    full,
    t,
    timeAgo,
  ]);

  const rows = groups.flatMap((g) => g.rows);
  // Each new query starts on its first result. Tied to what was typed, not
  // to the results, so ↓ pressed before they catch up still counts.
  const [selection, setSelection] = useState({ query, pick, at: 0 });
  const active =
    selection.query === query && selection.pick === pick
      ? Math.max(0, Math.min(selection.at, rows.length - 1))
      : 0;
  const select = (at: number) =>
    at !== active && setSelection({ query, pick, at });
  const optionId = (at: number) => `${listId}-${at}`;

  useEffect(() => {
    if (entered.current && typed === query) {
      entered.current = false;
      choose(rows[active]);
    }
    if (!follow.current) return;
    follow.current = false;
    document
      .getElementById(optionId(active))
      ?.scrollIntoView({ block: "nearest" });
  });

  function close(goBack: boolean) {
    entered.current = false;
    setOpen(false);
    setQuery("");
    setPick(null);
    setSelection({ query: "", pick: null, at: 0 });
    const before = returnTo.current;
    returnTo.current = null;
    if (goBack && before?.isConnected && before !== document.body)
      before.focus();
    else input.current?.blur();
  }

  function choose(row: Row | undefined) {
    if (!row || row.blocked) return;
    if (typeof row.open !== "function") {
      setPick(row.open.pick);
      setQuery("");
      return;
    }
    close(false);
    row.open(latest.current);
  }

  function onKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.nativeEvent.isComposing) return;
    const step = e.key === "ArrowDown" ? 1 : e.key === "ArrowUp" ? -1 : 0;
    if (step) {
      e.preventDefault();
      if (!open) return setOpen(true);
      follow.current = true;
      if (rows.length) select((active + step + rows.length) % rows.length);
    } else if (e.key === "Enter") {
      e.preventDefault();
      // What is listed is for an earlier query: open from the right list.
      if (typed !== query) entered.current = true;
      else choose(rows[active]);
    } else if (e.key === "Escape") {
      e.preventDefault();
      close(true);
    } else if (e.key === "Backspace" && !query && pick) {
      e.preventDefault();
      setPick(null);
    }
  }

  const number = new Intl.NumberFormat(language);
  const loading =
    open && !pick && !!typed.trim() && !index.files && !index.failed;
  const pickLabel =
    pick && t(`search.pick.${pick}`, { branch: snapshot.branches.current });
  let at = 0;

  return (
    <div
      className={`search-box ${open ? "open" : ""}`}
      ref={box}
      data-tauri-drag-region="false"
      onBlur={(e) => {
        // Switching to another window keeps it open for coming back.
        if (!document.hasFocus()) return;
        if (!box.current?.contains(e.relatedTarget as Node | null))
          setOpen(false);
      }}
    >
      <div className="search-field" onClick={() => input.current?.focus()}>
        <SearchIcon />
        {pickLabel && (
          <button
            className="search-pick"
            title={t("search.pick.leave")}
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => setPick(null)}
          >
            {pickLabel}
            <X />
          </button>
        )}
        <input
          ref={input}
          value={query}
          role="combobox"
          aria-label={t("search.label")}
          aria-expanded={open}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={
            open && rows.length ? optionId(active) : undefined
          }
          placeholder={t(pick ? "branchMenu.search" : "search.placeholder")}
          spellCheck={false}
          autoComplete="off"
          onFocus={() => setOpen(true)}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
          }}
          onKeyDown={onKeyDown}
        />
        {!open && !query && <kbd className="search-shortcut">Ctrl K</kbd>}
      </div>
      {open && (
        <div
          className="search-panel"
          data-tauri-drag-region="false"
          // Clicks keep focus in the field, so the keyboard goes on working.
          onMouseDown={(e) => e.preventDefault()}
        >
          <div className="search-results" role="listbox" id={listId}>
            {groups.map((group) => (
              <div
                className="search-group"
                role="group"
                aria-labelledby={`${listId}-${group.id}`}
                key={group.id}
              >
                <div className="search-heading" id={`${listId}-${group.id}`}>
                  <span>{t(GROUP_LABELS[group.id])}</span>
                  {group.total > group.rows.length && (
                    <span>
                      {t("search.count", {
                        shown: group.rows.length,
                        total: number.format(group.total),
                      })}
                    </span>
                  )}
                </div>
                {group.note && <p className="search-note">{group.note}</p>}
                {group.rows.map((row) => {
                  const i = at++;
                  return (
                    <div
                      key={row.key}
                      id={optionId(i)}
                      role="option"
                      aria-selected={i === active}
                      aria-disabled={!!row.blocked || undefined}
                      className={`search-row ${i === active ? "active" : ""} ${row.blocked ? "blocked" : ""}`}
                      onMouseMove={() => select(i)}
                      onClick={() => choose(row)}
                    >
                      <span className="search-row-icon">{row.icon}</span>
                      <span className="search-row-text">
                        <span className="search-row-title">
                          <Marked text={row.title} marks={row.marks} />
                        </span>
                        {row.detail && (
                          <span
                            className={`search-row-detail ${row.folder ? "path" : ""}`}
                          >
                            {row.detail}
                          </span>
                        )}
                      </span>
                      {row.note && (
                        <span className="search-row-note">{row.note}</span>
                      )}
                      {i === active && !row.blocked && (
                        <CornerDownLeft className="search-row-enter" />
                      )}
                    </div>
                  );
                })}
              </div>
            ))}
            {loading && <p className="search-empty">{t("search.loading")}</p>}
            {!rows.length && !loading && (
              <div className="search-empty">
                <strong>{t("search.nothing")}</strong>
                {!pick && <span>{t("search.nothingHint")}</span>}
              </div>
            )}
          </div>
          <div className="search-footer" aria-hidden="true">
            <span>
              <kbd>↑</kbd>
              <kbd>↓</kbd> {t("search.hint.move")}
            </span>
            <span>
              <kbd>Enter</kbd> {t("search.hint.open")}
            </span>
            <span>
              <kbd>Esc</kbd> {t("search.hint.close")}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
