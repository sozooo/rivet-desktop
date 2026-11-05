import type { RecentFile } from "../git/types";
import { fuzzyMatch, fuzzyScore, perfectScore, writeBonuses } from "./fuzzy";

/** A query as lower-case words; every word has to match. */
export const queryWords = (query: string) =>
  query.trim().toLowerCase().split(/\s+/).filter(Boolean);

/** A file prepared for searching. */
export type IndexedFile = {
  path: string;
  lower: string;
  /** Where the file name starts in `path`. */
  nameStart: number;
  /** When one of the latest commits changed it. */
  changedAt?: number;
  /** The latest commit that touched it deleted it. */
  deleted?: boolean;
  /**
   * A Unity .meta file whose asset or folder is in the list too: left out
   * unless the query asks for .meta files.
   */
  meta?: boolean;
};

export const indexedFile = (
  path: string,
  { changedAt, deleted, meta }: Partial<IndexedFile> = {},
): IndexedFile => ({
  path,
  lower: path.toLowerCase(),
  nameStart: path.lastIndexOf("/") + 1,
  // Every file has every field, so they all share one shape.
  changedAt,
  deleted,
  meta,
});

/**
 * Everything search looks through for files: the tracked ones, and the ones
 * recent commits deleted.
 */
export function indexFiles(
  tracked: readonly string[],
  recent: readonly RecentFile[],
): IndexedFile[] {
  const changed = new Map<string, number>();
  for (const r of recent) changed.set(r.path, r.date);
  const present = new Set(tracked);
  const deleted = recent.filter((r) => r.deleted && !present.has(r.path));
  const gone = new Set(deleted.map((r) => r.path));
  // Folders count as present too: a folder's .meta goes with it.
  const folders = new Set<string>();
  for (const path of tracked)
    for (let end = path.lastIndexOf("/"); end > 0;) {
      const folder = path.slice(0, end);
      if (folders.has(folder)) break;
      folders.add(folder);
      end = path.lastIndexOf("/", end - 1);
    }
  const isMeta = (path: string, among: Set<string>) => {
    if (!path.endsWith(".meta")) return undefined;
    const asset = path.slice(0, -5);
    return among.has(asset) || folders.has(asset) || undefined;
  };
  const files: IndexedFile[] = new Array(tracked.length + deleted.length);
  tracked.forEach((path, i) => {
    files[i] = indexedFile(path, {
      changedAt: changed.get(path),
      meta: isMeta(path, present),
    });
  });
  deleted.forEach((r, i) => {
    files[tracked.length + i] = indexedFile(r.path, {
      changedAt: r.date,
      deleted: true,
      meta: isMeta(r.path, gone),
    });
  });
  return files;
}

export type FileHit = {
  file: IndexedFile;
  score: number;
  /** 0–1: how close the match is to a perfect one; orders groups. */
  quality: number;
  /** Every word matched within the file name, not just the path. */
  inName: boolean;
};

/**
 * Below this a match is letters scattered across the text, which a long
 * path or summary has for almost any query: not worth showing.
 */
const MIN_QUALITY = 0.4;
/** Changed lately: likely what someone is looking for. */
const RECENT_BONUS = 6;
const DELETED_PENALTY = -10;
/** The whole file name, extension aside, is the word. */
const EXACT_BONUS = 8;

/** The file name, extension aside, is exactly the word. */
function wholeName(file: IndexedFile, word: string) {
  const dot = file.lower.lastIndexOf(".");
  const end = dot > file.nameStart ? dot : file.lower.length;
  return (
    end - file.nameStart === word.length &&
    file.lower.startsWith(word, file.nameStart)
  );
}

/**
 * How a file matches the words: within its name if it can, or else its
 * path. `bonus` holds what its characters are worth, from `base`.
 */
function matchFile(
  words: readonly string[],
  file: IndexedFile,
  bonus: Int8Array,
  base: number,
  perfect: number,
): FileHit | null {
  let score = 0,
    inName = true;
  const { lower, nameStart } = file;
  for (const word of words) {
    const named =
      word.indexOf("/") < 0
        ? fuzzyScore(word, lower, bonus, base, nameStart, lower.length)
        : null;
    if (named !== null) {
      score += named + (wholeName(file, word) ? EXACT_BONUS : 0);
      continue;
    }
    const pathed = fuzzyScore(word, lower, bonus, base, 0, lower.length);
    if (pathed === null) return null;
    score += pathed;
    inName = false;
  }
  // A weak match still counts as one for narrowing: typing more can make it a good one.
  const quality = perfect ? Math.min(1, score / perfect) : 0;
  if (file.deleted) score += DELETED_PENALTY;
  else if (file.changedAt !== undefined) score += RECENT_BONUS;
  return { file, score, quality, inName };
}

const fileOrder = (a: FileHit, b: FileHit) =>
  Number(b.inName) - Number(a.inName) ||
  b.score - a.score ||
  a.file.path.length -
    a.file.nameStart -
    (b.file.path.length - b.file.nameStart) ||
  a.file.path.length - b.file.path.length ||
  (a.file.path < b.file.path ? -1 : 1);

/** Keeps the `limit` best of what it is given, in order. */
function bestOf<T>(limit: number, order: (a: T, b: T) => number) {
  const kept: T[] = [];
  return {
    kept,
    offer(item: T) {
      if (kept.length === limit && order(item, kept[limit - 1]) >= 0) return;
      let i = kept.length === limit ? limit - 1 : kept.length;
      while (i > 0 && order(item, kept[i - 1]) < 0) {
        kept[i] = kept[i - 1];
        i--;
      }
      kept[i] = item;
    },
  };
}

export type FileResults = { hits: FileHit[]; total: number };

/**
 * Searches a list of files. Typing goes one character at a time, so when a
 * query only adds to the previous one, it looks through the previous
 * matches instead of every file again.
 */
export function fileSearch(files: readonly IndexedFile[]) {
  // What every character of every path is worth, worked out once.
  const offsets = new Int32Array(files.length);
  let length = 0;
  files.forEach((file, i) => {
    offsets[i] = length;
    length += file.lower.length;
  });
  const bonus = new Int8Array(length);
  files.forEach((file, i) =>
    writeBonuses(
      file.path.length === file.lower.length ? file.path : file.lower,
      bonus,
      offsets[i],
    ),
  );
  let previous: { query: string; matches: number[] } | null = null;
  return (
    words: readonly string[],
    limit: number,
    skip?: (file: IndexedFile) => boolean,
  ): FileResults => {
    const query = words.join(" ");
    const wantMeta = words.some((w) => w.includes("meta"));
    const perfect = words.reduce((sum, w) => sum + perfectScore(w.length), 0);
    const pool =
      previous?.query && query.startsWith(previous.query)
        ? previous.matches
        : null;
    const count = pool ? pool.length : files.length;
    const matches: number[] = [];
    const best = bestOf(limit, fileOrder);
    let total = 0;
    for (let n = 0; n < count; n++) {
      const i = pool ? pool[n] : n;
      const file = files[i];
      const hit = matchFile(words, file, bonus, offsets[i], perfect);
      if (!hit) continue;
      matches.push(i);
      if (hit.quality < MIN_QUALITY) continue;
      if ((file.meta && !wantMeta) || skip?.(file)) continue;
      total++;
      best.offer(hit);
    }
    previous = { query, matches };
    return { hits: best.kept, total };
  };
}

export type Hit<T> = {
  item: T;
  score: number;
  quality: number;
  /** Which characters matched in each of the item's fields, for highlighting. */
  positions: number[][];
};

/** Later fields count a little less: a match in the title beats one in the details. */
const FIELD_PENALTY = 6;

/**
 * Ranks short lists (versions, branches, actions) by their fields, each
 * word matching in whichever field suits it best. With no words, keeps the
 * order they came in.
 */
export function rankItems<T>(
  items: readonly T[],
  words: readonly string[],
  fields: (item: T) => readonly string[],
  limit: number,
  /** Words that pick an item outright, like a commit's sha. */
  exact?: (item: T, word: string) => boolean,
): { hits: Hit<T>[]; total: number } {
  if (!words.length)
    return {
      hits: items.slice(0, limit).map((item) => ({
        item,
        score: 0,
        quality: 0,
        positions: fields(item).map(() => []),
      })),
      total: items.length,
    };
  const order = (a: Hit<T>, b: Hit<T>) => b.score - a.score;
  const best = bestOf(limit, order);
  let total = 0;
  for (const item of items) {
    const hit = matchFields(item, words, fields(item), false, exact);
    if (!hit) continue;
    total++;
    best.offer(hit);
  }
  // Highlights only for what is shown.
  const hits = best.kept.map(
    (hit) => matchFields(hit.item, words, fields(hit.item), true, exact) ?? hit,
  );
  return { hits, total };
}

function matchFields<T>(
  item: T,
  words: readonly string[],
  texts: readonly string[],
  withPositions: boolean,
  exact?: (item: T, word: string) => boolean,
): Hit<T> | null {
  let score = 0,
    best = 0;
  const positions = texts.map(() => [] as number[]);
  for (const word of words) {
    const perfect = perfectScore(word.length);
    best += perfect;
    if (exact?.(item, word)) {
      score += perfect;
      continue;
    }
    let found: { score: number; field: number; at?: number[] } | null = null;
    for (let field = 0; field < texts.length; field++) {
      const match =
        texts[field] &&
        fuzzyMatch(word, texts[field], undefined, withPositions);
      if (!match) continue;
      const value = match.score - field * FIELD_PENALTY;
      if (!found || value > found.score)
        found = { score: value, field, at: match.positions };
    }
    if (!found) return null;
    score += found.score;
    if (found.at) positions[found.field].push(...found.at);
  }
  const quality = best ? Math.max(0, Math.min(1, score / best)) : 0;
  return quality < MIN_QUALITY ? null : { item, score, quality, positions };
}

/** Which characters of a file's name and folder matched, for highlighting. */
export function fileHighlights(words: readonly string[], file: IndexedFile) {
  const name = file.path.slice(file.nameStart);
  const lowerName = file.lower.slice(file.nameStart);
  const inName: number[] = [],
    inFolder: number[] = [];
  for (const word of words) {
    const named = word.includes("/")
      ? null
      : fuzzyMatch(word, name, lowerName, true);
    if (named) {
      inName.push(...named.positions!);
      continue;
    }
    const pathed = fuzzyMatch(word, file.path, file.lower, true);
    for (const at of pathed?.positions ?? [])
      if (at >= file.nameStart) inName.push(at - file.nameStart);
      else inFolder.push(at);
  }
  return { name: inName, folder: inFolder };
}

/**
 * How strongly a group's best result matches: groups with a clearly better
 * match go first, and otherwise groups keep their usual order.
 */
export const strength = (quality: number) =>
  quality >= 0.8 ? 2 : quality >= 0.45 ? 1 : 0;
