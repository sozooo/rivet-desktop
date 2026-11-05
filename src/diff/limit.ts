import type { Hunk } from "../git/types";

/**
 * Tens of thousands of diff lines (a font atlas, a big scene saved as text)
 * would freeze the window, so a diff shows its first lines until asked for all.
 */
export const DIFF_LINE_LIMIT = 3000;

/** The hunks to draw within `limit` lines, the last one cut short if needed. */
export function limitHunks(hunks: Hunk[], limit = DIFF_LINE_LIMIT) {
  const total = hunks.reduce((sum, h) => sum + h.lines.length, 0);
  if (total <= limit) return { hunks, total, shown: total };
  const shown: Hunk[] = [];
  let left = limit;
  for (const hunk of hunks) {
    if (left <= 0) break;
    shown.push(
      hunk.lines.length <= left
        ? hunk
        : { ...hunk, lines: hunk.lines.slice(0, left) },
    );
    left -= hunk.lines.length;
  }
  return { hunks: shown, total, shown: limit };
}
