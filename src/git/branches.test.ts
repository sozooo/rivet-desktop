import { describe, expect, it } from "vitest";
import { branchLabel, localName, remoteOnly } from "./branches";

const branches = (local: string[], remote: string[]) => ({
  current: local[0],
  local,
  remote,
  tags: [],
});

describe("branches", () => {
  it("names a server branch the way this computer will", () => {
    expect(localName("origin/feature/hair")).toBe("feature/hair");
    expect(branchLabel("origin/art/forest", ["main"])).toBe("art/forest");
    expect(branchLabel("main", ["main"])).toBe("main");
  });

  it("lists server branches without a local copy, once per name", () => {
    expect(
      remoteOnly(
        branches(
          ["main", "develop"],
          [
            "origin/main",
            "origin/art/forest",
            "upstream/art/forest",
            "origin/develop",
          ],
        ),
      ),
    ).toEqual(["origin/art/forest"]);
  });
});
