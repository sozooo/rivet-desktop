import { describe, expect, it } from "vitest";
import type { Hunk } from "../git/types";
import { alignLines, changedRange, hunkLabel } from "./align";

const hunk: Hunk = {
  header: "@@ -10,99 +10,99 @@ Update()",
  staged: false,
  lines: [
    { kind: "context", text: "a" },
    { kind: "del", text: "old" },
    { kind: "add", text: "new one" },
    { kind: "add", text: "new two" },
    { kind: "context", text: "b" },
  ],
};

describe("alignLines", () => {
  it("pairs removed and added lines and numbers both sides", () => {
    const rows = alignLines(hunk);
    expect(rows.map((r) => [r.left?.number, r.right?.number])).toEqual([
      [10, 10],
      [11, 11],
      [undefined, 12],
      [12, 13],
    ]);
    expect(rows[1].left?.counterpart).toBe("new one");
  });
});

describe("hunkLabel", () => {
  it("recomputes line counts from the actual lines", () => {
    expect(hunkLabel(hunk)).toBe("@@ -10,3 +10,4 @@ Update()");
  });
});

describe("changedRange", () => {
  it("finds the differing middle of two lines", () => {
    const text = "float jumpHeight = 2f;";
    const { start, end } = changedRange(text, "float jumpForce = 8f;");
    expect(text.slice(start, end)).toBe("Height = 2");
  });
});
