import type { DiffLine, Hunk } from "../git/types";

export type Cell = { line: DiffLine; number: number; counterpart?: string };
export type Row = { left?: Cell; right?: Cell };

/** Pairs removed and added lines so side-by-side rows line up. */
export function alignLines(hunk: Hunk): Row[] {
  let oldNumber = Number(hunk.header.match(/-(\d+)/)?.[1] || 1);
  let newNumber = Number(hunk.header.match(/\+(\d+)/)?.[1] || 1);
  const rows: Row[] = [];
  for (let i = 0; i < hunk.lines.length;) {
    const line = hunk.lines[i];
    if (line.kind === "context") {
      rows.push({
        left: { line, number: oldNumber++ },
        right: { line, number: newNumber++ },
      });
      i++;
      continue;
    }
    const removed: DiffLine[] = [],
      added: DiffLine[] = [];
    while (i < hunk.lines.length && hunk.lines[i].kind !== "context") {
      (hunk.lines[i].kind === "del" ? removed : added).push(hunk.lines[i++]);
    }
    for (let j = 0; j < Math.max(removed.length, added.length); j++) {
      rows.push({
        left: removed[j] && {
          line: removed[j],
          number: oldNumber++,
          counterpart: added[j]?.text,
        },
        right: added[j] && {
          line: added[j],
          number: newNumber++,
          counterpart: removed[j]?.text,
        },
      });
    }
  }
  return rows;
}

/** Recomputes the line counts in a hunk header from its actual lines. */
export function hunkLabel(hunk: Hunk) {
  const oldCount = hunk.lines.filter((l) => l.kind !== "add").length;
  const newCount = hunk.lines.filter((l) => l.kind !== "del").length;
  return hunk.header.replace(
    /-(\d+)(?:,\d+)? \+(\d+)(?:,\d+)?/,
    `-$1,${oldCount} +$2,${newCount}`,
  );
}

/** The part of `text` that differs from `other`, by common prefix and suffix. */
export function changedRange(text: string, other: string) {
  let start = 0,
    end = text.length,
    otherEnd = other.length;
  while (start < end && start < otherEnd && text[start] === other[start])
    start++;
  while (
    end > start &&
    otherEnd > start &&
    text[end - 1] === other[otherEnd - 1]
  ) {
    end--;
    otherEnd--;
  }
  return { start, end };
}
