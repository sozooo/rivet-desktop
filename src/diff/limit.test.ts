import { describe, expect, it } from "vitest";
import type { Hunk } from "../git/types";
import { limitHunks } from "./limit";

const hunk = (lines: number): Hunk => ({
  header: "@@",
  staged: false,
  lines: Array.from({ length: lines }, (_, i) => ({
    kind: "context",
    text: String(i),
  })) as Hunk["lines"],
});

describe("limitHunks", () => {
  it("keeps small diffs whole", () => {
    const hunks = [hunk(10), hunk(20)];
    expect(limitHunks(hunks, 100)).toEqual({ hunks, total: 30, shown: 30 });
  });

  it("cuts a huge diff at the limit, inside a hunk if needed", () => {
    const result = limitHunks([hunk(60), hunk(5000), hunk(10)], 100);
    expect(result.total).toBe(5070);
    expect(result.shown).toBe(100);
    expect(result.hunks.map((h) => h.lines.length)).toEqual([60, 40]);
  });
});
