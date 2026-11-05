/**
 * Fuzzy matching for search, in the spirit of fzf: the query's characters
 * must appear in the text in order, and the score rewards characters that
 * follow each other and ones that start a word, so "plco" finds
 * "PlayerController" before "pool_cover".
 *
 * After skipping part of the text, matching picks up again only where a
 * word starts (or at a separator or digit): "tree" finds "Tree.prefab" and
 * "TerrainRecolorEdge", but not the letters strewn through
 * "Textures/Environment". Long paths and messages have those for almost any
 * query, and they bury what was meant.
 */

const MATCH = 16;
/** Skipping characters between two matched ones: the first costs this… */
const GAP_START = -3;
/** …and each further one this. */
const GAP_EXTEND = -1;
/** A character after a separator, or the text's first: the start of a word. */
const BOUNDARY = 8;
/** An upper-case letter after a lower-case one, or a digit after a letter. */
const CAMEL = 7;
/** A separator or a digit inside a number: matching may resume here, for little. */
const RESUME = 1;
/** Each character right after the previous matched one gets at least this. */
const CONSECUTIVE = 4;
/** Where the first character matched counts double. */
const FIRST = 2;

const NONE = -(1 << 29);

export type Match = {
  score: number;
  /** Indices of the matched characters, when asked for. */
  positions?: number[];
};

const OTHER = 0,
  LOWER = 1,
  UPPER = 2,
  DIGIT = 3,
  SEPARATOR = 4;
const ASCII = new Uint8Array(128);
for (let code = 0; code < 128; code++)
  ASCII[code] =
    code >= 97 && code <= 122
      ? LOWER
      : code >= 65 && code <= 90
        ? UPPER
        : code >= 48 && code <= 57
          ? DIGIT
          : OTHER;
for (const c of " /\\_-.@()[]{},:;'\"#+&") ASCII[c.charCodeAt(0)] = SEPARATOR;

function kind(text: string, i: number) {
  const code = text.charCodeAt(i);
  if (code < 128) return ASCII[code];
  const c = text[i];
  return c !== c.toLowerCase() ? UPPER : c !== c.toUpperCase() ? LOWER : OTHER;
}

/**
 * How much each character of `text` is worth as a match: word starts most,
 * places inside a word nothing. Written to `out` from `at`; a file list
 * keeps these for all its paths, so typing doesn't work them out again.
 */
export function writeBonuses(text: string, out: Int8Array, at = 0) {
  let before = SEPARATOR;
  for (let i = 0; i < text.length; i++) {
    const here = kind(text, i);
    out[at + i] =
      before === SEPARATOR
        ? BOUNDARY
        : before === LOWER && here === UPPER
          ? CAMEL
          : here === DIGIT && before !== DIGIT
            ? CAMEL
            : here === DIGIT || here === SEPARATOR
              ? RESUME
              : 0;
    before = here;
  }
}

/** The best score a query of this length can get: every character in one run at a word start. */
export const perfectScore = (length: number) =>
  length > 0 ? MATCH + BOUNDARY * FIRST + (length - 1) * (MATCH + BOUNDARY) : 0;

// Rows reused between calls: search scores tens of thousands of paths per keystroke.
let capacity = 0;
let rowA = new Int32Array(0),
  rowB = new Int32Array(0),
  runA = new Int8Array(0),
  runB = new Int8Array(0),
  scratch = new Int8Array(0);
function reserve(size: number) {
  if (size <= capacity) return;
  capacity = Math.max(size, capacity * 2, 256);
  rowA = new Int32Array(capacity);
  rowB = new Int32Array(capacity);
  runA = new Int8Array(capacity);
  runB = new Int8Array(capacity);
  scratch = new Int8Array(capacity);
}

/**
 * How well `query` matches `text`, or null when it doesn't. `query` must be
 * lower case without spaces; `lower` is `text` in lower case, passed in when
 * the caller keeps it. With `withPositions`, also says which characters
 * matched, for highlighting.
 */
export function fuzzyMatch(
  query: string,
  text: string,
  lower = text.toLowerCase(),
  withPositions = false,
): Match | null {
  if (!query.length)
    return { score: 0, positions: withPositions ? [] : undefined };
  // A few characters change length in lower case; then read words from `lower`.
  const source = lower.length === text.length ? text : lower;
  reserve(source.length);
  const bonus = scratch;
  writeBonuses(source, bonus);
  if (withPositions) return alignment(query, lower, bonus, 0, 0, lower.length);
  const score = fuzzyScore(query, lower, bonus, 0, 0, lower.length);
  return score === null ? null : { score };
}

/**
 * Where a match has to fall: from the first place the whole query fits, to
 * the last place its final character appears. Null when it doesn't fit.
 */
function span(query: string, lower: string, from: number, to: number) {
  const m = query.length;
  let start = -1,
    k = 0;
  for (let i = from; i < to && k < m; i++) {
    if (lower.charCodeAt(i) !== query.charCodeAt(k)) continue;
    if (k++ === 0) start = i;
  }
  if (k < m) return null;
  const last = query.charCodeAt(m - 1);
  let end = to - 1;
  while (lower.charCodeAt(end) !== last) end--;
  return { start, width: end - start + 1 };
}

/**
 * fuzzyMatch's score for `lower` from `from` to `to`, with the bonuses
 * already worked out in `bonus` from `base` (where `lower`'s first
 * character's is).
 */
export function fuzzyScore(
  query: string,
  lower: string,
  bonus: Int8Array,
  base: number,
  from: number,
  to: number,
): number | null {
  const m = query.length;
  if (!m) return 0;
  const found = span(query, lower, from, to);
  if (!found) return null;
  const { start, width } = found;
  reserve(width);
  const at = base + start;
  let previous = rowA,
    current = rowB,
    previousRun = runA,
    currentRun = runB;
  for (let i = 0; i < m; i++) {
    const wanted = query.charCodeAt(i);
    let gap = NONE;
    for (let j = 0; j < width; j++) {
      if (i > 0 && j >= 2) {
        const opened = previous[j - 2];
        gap = Math.max(
          gap + GAP_EXTEND,
          opened > NONE ? opened + GAP_START : NONE,
        );
      }
      if (j < i || lower.charCodeAt(start + j) !== wanted) {
        current[j] = NONE;
        continue;
      }
      const worth = bonus[at + j];
      if (i === 0) {
        current[j] = MATCH + worth * FIRST;
        currentRun[j] = worth;
        continue;
      }
      let best = NONE,
        run = 0;
      const diagonal = j > 0 ? previous[j - 1] : NONE;
      if (diagonal > NONE) {
        const carried = previousRun[j - 1];
        best = diagonal + MATCH + Math.max(worth, carried, CONSECUTIVE);
        run = Math.max(worth, carried);
      }
      // Only a word start (any bonus at all) may come after skipped text.
      if (worth && gap > NONE / 2 && gap + MATCH + worth > best) {
        best = gap + MATCH + worth;
        run = worth;
      }
      current[j] = best;
      currentRun[j] = run;
    }
    [previous, current] = [current, previous];
    [previousRun, currentRun] = [currentRun, previousRun];
  }
  let score = NONE;
  for (let j = 0; j < width; j++) if (previous[j] > score) score = previous[j];
  return score > NONE / 2 ? score : null;
}

/** The same scoring with the whole table kept, to trace back which characters matched. */
function alignment(
  query: string,
  lower: string,
  bonus: Int8Array,
  base: number,
  from: number,
  to: number,
): Match | null {
  const m = query.length;
  const found = span(query, lower, from, to);
  if (!found) return null;
  const { start, width } = found;
  const at = base + start;
  const score = new Int32Array(m * width).fill(NONE);
  const run = new Int8Array(m * width);
  /** Where each cell's previous matched character was. */
  const came = new Int32Array(m * width).fill(-1);
  for (let i = 0; i < m; i++) {
    const wanted = query.charCodeAt(i);
    let gap = NONE,
      gapFrom = -1;
    const row = i * width,
      above = row - width;
    for (let j = 0; j < width; j++) {
      if (i > 0 && j >= 2) {
        const opened = score[above + j - 2];
        const extended = gap + GAP_EXTEND;
        if (opened > NONE && opened + GAP_START >= extended) {
          gap = opened + GAP_START;
          gapFrom = j - 2;
        } else gap = extended;
      }
      if (j < i || lower.charCodeAt(start + j) !== wanted) continue;
      const worth = bonus[at + j];
      if (i === 0) {
        score[row + j] = MATCH + worth * FIRST;
        run[row + j] = worth;
        continue;
      }
      const diagonal = j > 0 ? score[above + j - 1] : NONE;
      if (diagonal > NONE) {
        const carried = run[above + j - 1];
        score[row + j] =
          diagonal + MATCH + Math.max(worth, carried, CONSECUTIVE);
        run[row + j] = Math.max(worth, carried);
        came[row + j] = j - 1;
      }
      if (worth && gap > NONE / 2 && gap + MATCH + worth > score[row + j]) {
        score[row + j] = gap + MATCH + worth;
        run[row + j] = worth;
        came[row + j] = gapFrom;
      }
    }
  }
  const last = (m - 1) * width;
  let best = -1;
  for (let j = 0; j < width; j++)
    if (
      score[last + j] > NONE / 2 &&
      (best < 0 || score[last + j] > score[last + best])
    )
      best = j;
  if (best < 0) return null;
  const positions = new Array<number>(m);
  for (let i = m - 1, j = best; i >= 0; i--) {
    positions[i] = start + j;
    j = came[i * width + j];
  }
  return { score: score[last + best], positions };
}
