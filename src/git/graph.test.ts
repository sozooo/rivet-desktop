import { describe, expect, it } from "vitest";
import { layoutGraph } from "./graph";
import type { Commit } from "./types";

const c = (sha: string, ...parents: string[]): Commit => ({
  sha,
  summary: sha,
  description: "",
  author: { name: "A", email: "a@a" },
  date: 0,
  parents,
});

describe("layoutGraph", () => {
  it("keeps a linear history in one lane", () => {
    const { rows, width } = layoutGraph([c("c", "b"), c("b", "a"), c("a")]);
    expect(rows.map((r) => r.lane)).toEqual([0, 0, 0]);
    expect(width).toBe(1);
  });

  it("opens a lane for a merged branch and closes it at the fork point", () => {
    const { rows, width } = layoutGraph([
      c("merge", "main1", "side1"),
      c("side1", "base"),
      c("main1", "base"),
      c("base"),
    ]);
    expect(rows.map((r) => r.lane)).toEqual([0, 1, 0, 0]);
    expect(rows[0].parents).toEqual([0, 1]);
    expect(rows[3].joining).toEqual([1]);
    expect(width).toBe(2);
  });

  it("keeps the first-parent line in its lane when another lane waits for the same commit", () => {
    // After a pull: remote commits and a local merge both descend from "base".
    const { rows } = layoutGraph([
      c("pull", "local", "remote"),
      c("remote", "base"),
      c("local", "base", "side"),
      c("side", "base"),
      c("base"),
    ]);
    expect(rows.map((r) => r.lane)).toEqual([0, 1, 0, 2, 0]);
    expect(rows[4].joining).toEqual([1, 2]);
  });
});
