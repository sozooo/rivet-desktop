import { describe, expect, it } from "vitest";
import { fuzzyMatch, perfectScore } from "./fuzzy";
import {
  fileHighlights,
  fileSearch,
  indexFiles,
  indexedFile,
  queryWords,
  rankItems,
} from "./rank";

const score = (query: string, text: string) =>
  fuzzyMatch(query, text)?.score ?? null;
/** The texts in the order search ranks them for `query`. */
const order = (query: string, texts: string[]) =>
  texts
    .map((text) => ({ text, score: score(query, text) }))
    .filter((t) => t.score !== null)
    .sort((a, b) => b.score! - a.score!)
    .map((t) => t.text);

describe("fuzzyMatch", () => {
  it("needs every character, in order", () => {
    expect(score("plc", "PlayerController.cs")).not.toBeNull();
    expect(score("cpl", "PlayerController.cs")).toBeNull();
    expect(score("playerx", "PlayerController.cs")).toBeNull();
    expect(score("", "anything")).toBe(0);
  });

  it("ignores case, Cyrillic too", () => {
    expect(score("дерево", "Дерево_Кора.png")).not.toBeNull();
    expect(score("tree", "TREE.prefab")).not.toBeNull();
  });

  it("prefers characters that follow each other", () => {
    expect(order("tree", ["Terrain_Recolor_Edge.png", "Tree.prefab"])).toEqual([
      "Tree.prefab",
      "Terrain_Recolor_Edge.png",
    ]);
    expect(order("bark", ["BigArmorRack.fbx", "Bark.png"])[0]).toBe("Bark.png");
  });

  it("prefers the starts of words, camelCase and separators alike", () => {
    expect(order("pc", ["Epic.cs", "PlayerController.cs"])[0]).toBe(
      "PlayerController.cs",
    );
    expect(order("hw", ["Shower.fbx", "Hero@Wave.fbx"])[0]).toBe(
      "Hero@Wave.fbx",
    );
    expect(order("rl", ["Barrel.fbx", "Rock_Large.fbx"])[0]).toBe(
      "Rock_Large.fbx",
    );
  });

  it("picks up after a skip only where a word starts", () => {
    expect(score("tree", "Textures/Environment")).toBeNull();
    expect(score("tree", "TerrainRecolorEdge.png")).not.toBeNull();
    expect(score("bkn", "Bark_Normal.png")).toBeNull();
    expect(score("bnor", "Bark_Normal.png")).not.toBeNull();
    // Inside a word the letters just have to follow each other.
    expect(score("amera", "MainCamera.cs")).not.toBeNull();
    // Digits and separators count as places to pick up again.
    expect(score("rock42", "Rock_0042.png")).not.toBeNull();
    expect(score("tree.prefab", "Tree_Big.prefab")).not.toBeNull();
  });

  it("scores a run at a word start as perfect", () => {
    expect(score("camera", "Camera.cs")).toBe(perfectScore(6));
    expect(score("camera", "MyCamera.cs")).toBeLessThanOrEqual(perfectScore(6));
    expect(score("amera", "Camera.cs")!).toBeLessThan(perfectScore(5));
  });

  it("finds the best alignment, not the first one", () => {
    // Greedy matching would take the "c" of "Scripts" and the "a" after it.
    const match = fuzzyMatch("cam", "Scripts/Camera.cs", undefined, true);
    expect(match?.positions).toEqual([8, 9, 10]);
  });

  it("reports positions that score the same as without them", () => {
    for (const [query, text] of [
      ["plco", "Assets/Scripts/Player/PlayerController.cs"],
      ["bnor", "Bark_Normal.png"],
      ["x", "box"],
    ]) {
      const plain = fuzzyMatch(query, text);
      const traced = fuzzyMatch(query, text, undefined, true);
      expect(traced?.score).toBe(plain?.score);
      expect(
        traced?.positions?.map((i) => text[i].toLowerCase()).join(""),
      ).toBe(query);
    }
  });
});

describe("file search", () => {
  const files = indexFiles(
    [
      "Assets/Textures/Bark.png",
      "Assets/Textures/Bark.png.meta",
      "Assets/Textures.meta",
      "Assets/Prefabs/Tree.prefab",
      "Assets/Prefabs/Tree.prefab.meta",
      "Assets/Trees/Oak.fbx",
      "Assets/Scripts/Player/PlayerController.cs",
      "Art/Tree.blend",
      "Orphan.meta",
    ],
    [
      {
        path: "Assets/Textures/Bark_Old.png",
        sha: "c5d2f80",
        date: 3,
        deleted: true,
      },
      {
        path: "Assets/Textures/Bark_Old.png.meta",
        sha: "c5d2f80",
        date: 3,
        deleted: true,
      },
      { path: "Art/Tree.blend", sha: "a7c92e1", date: 5, deleted: false },
    ],
  );
  const search = (query: string, limit = 10) =>
    fileSearch(files)(queryWords(query), limit).hits.map((h) => h.file.path);

  it("leaves out letters scattered across a path", () => {
    expect(search("tree")).not.toContain(
      "Assets/Scripts/Player/PlayerController.cs",
    );
  });

  it("puts file-name matches before path matches", () => {
    expect(search("tree")).toEqual([
      // Changed lately, so first among equals.
      "Art/Tree.blend",
      "Assets/Prefabs/Tree.prefab",
      "Assets/Trees/Oak.fbx",
    ]);
  });

  it("keeps deleted files, after the ones still there", () => {
    expect(search("bark")).toEqual([
      "Assets/Textures/Bark.png",
      "Assets/Textures/Bark_Old.png",
    ]);
    expect(files.find((f) => f.path.endsWith("Bark_Old.png"))?.deleted).toBe(
      true,
    );
  });

  it("leaves out .meta files of listed assets and folders, unless asked", () => {
    expect(search("textures")).toEqual([
      "Assets/Textures/Bark.png",
      "Assets/Textures/Bark_Old.png",
    ]);
    expect(search("orphan")).toEqual(["Orphan.meta"]);
    expect(search("bark meta")).toContain("Assets/Textures/Bark.png.meta");
  });

  it("matches each word, and words with a slash against the path", () => {
    expect(search("player cs")).toEqual([
      "Assets/Scripts/Player/PlayerController.cs",
    ]);
    expect(search("art/tree")).toEqual(["Art/Tree.blend"]);
  });

  it("counts every match but returns only the best few", () => {
    const result = fileSearch(files)(queryWords("a"), 2);
    expect(result.hits).toHaveLength(2);
    expect(result.total).toBeGreaterThan(2);
  });

  it("narrows the previous matches as the query grows, with the same results", () => {
    const words = ["Rock", "Tree", "Moss", "Log", "Barrel", "Fence"];
    const many = indexFiles(
      Array.from(
        { length: 3000 },
        (_, i) =>
          `Assets/${words[i % 5]}s/${words[(i * 7) % 6]}${words[(i * 3) % 6]}_${i}.png`,
      ).concat("Assets/Env/Tree_Big.png"),
      [],
    );
    for (const query of ["tree b", "rocklog", "trees/mo", "fence 12", "rl"]) {
      const typing = fileSearch(many);
      for (let end = 1; end <= query.length; end++) {
        const words = queryWords(query.slice(0, end));
        const typed = typing(words, 5);
        const fresh = fileSearch(many)(words, 5);
        expect(typed.total).toBe(fresh.total);
        expect(typed.hits.map((h) => h.file.path)).toEqual(
          fresh.hits.map((h) => h.file.path),
        );
      }
    }
    // Backspace: a shorter query looks through everything again.
    const typing = fileSearch(many);
    const tree = typing(queryWords("tree"), 5).total;
    const r = typing(queryWords("r"), 5).total;
    expect(r).toBe(fileSearch(many)(queryWords("r"), 5).total);
    expect(r).toBeGreaterThan(tree);
  });

  it("finds a file among 50,000 quickly", () => {
    const paths = Array.from(
      { length: 50_000 },
      (_, i) =>
        `Assets/Environment/Area${i % 37}/Props/Prop${i}_${["Albedo", "Normal", "Mask"][i % 3]}.png`,
    );
    paths.push("Assets/Characters/Hero/HeroController.cs");
    const big = fileSearch(indexFiles(paths, []));
    const started = performance.now();
    const result = big(queryWords("herocon"), 8);
    const elapsed = performance.now() - started;
    expect(result.hits[0].file.path).toBe(
      "Assets/Characters/Hero/HeroController.cs",
    );
    // Generous for slow test machines; in the app this takes a few ms.
    expect(elapsed).toBeLessThan(400);
  });

  it("highlights matches in the name and the folder", () => {
    const file = indexedFile("Assets/Prefabs/Tree.prefab");
    expect(fileHighlights(["tree"], file)).toEqual({
      name: [0, 1, 2, 3],
      folder: [],
    });
    expect(fileHighlights(["prefabs/"], file).folder).toEqual([
      7, 8, 9, 10, 11, 12, 13, 14,
    ]);
  });
});

describe("rankItems", () => {
  const commits = [
    {
      sha: "a7c92e1",
      summary: "Improve camera follow smoothing",
      author: "Alex",
    },
    { sha: "d84e2a9", summary: "Add gamepad input support", author: "Jamie" },
    { sha: "e29a641", summary: "Add outline shader", author: "Jamie" },
  ];
  const rank = (query: string, limit = 5) =>
    rankItems(
      commits,
      queryWords(query),
      (c) => [c.summary, c.author],
      limit,
      (c, word) => word.length >= 4 && c.sha.startsWith(word),
    );

  it("matches any field, the first one counting most", () => {
    expect(rank("camera").hits.map((h) => h.item.sha)).toEqual(["a7c92e1"]);
    expect(rank("jamie").hits.map((h) => h.item.sha)).toEqual([
      "d84e2a9",
      "e29a641",
    ]);
    expect(rank("add jamie").total).toBe(2);
  });

  it("finds a commit by the start of its sha", () => {
    expect(rank("e29a").hits.map((h) => h.item.sha)).toEqual(["e29a641"]);
  });

  it("returns highlights for what it shows", () => {
    const [hit] = rank("cam").hits;
    expect(hit.positions[0]).toEqual([8, 9, 10]);
    expect(hit.quality).toBe(1);
  });

  it("keeps the given order without a query", () => {
    expect(rank("", 2).hits.map((h) => h.item.sha)).toEqual([
      "a7c92e1",
      "d84e2a9",
    ]);
    expect(rank("", 2).total).toBe(3);
  });
});
