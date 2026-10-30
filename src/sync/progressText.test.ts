import { describe, expect, it } from "vitest";
import type { GitProgress } from "../git/progress";
import {
  translate,
  type Key,
  type Language,
  type Params,
  type UiMode,
} from "../i18n/i18n";
import { progressDetail, progressLabel } from "./progressText";

const MiB = 1024 * 1024;
const translator =
  (language: Language, mode: UiMode) => (key: Key, params?: Params) =>
    translate(language, mode, key, params);

const files: GitProgress = {
  phase: "download",
  percent: 25,
  files: { done: 3, total: 10 },
  bytes: { done: 120 * MiB, total: 480 * MiB },
};

describe("progress texts", () => {
  it("adds the percent to what the button already says", () => {
    const t = translator("ru", "simple");
    expect(
      progressLabel("Забираю…", { phase: "receive", percent: 42 }, t),
    ).toBe("Забираю… 42%");
    expect(
      progressLabel("Забираю…", { phase: "prepare", percent: null }, t),
    ).toBe("Забираю…");
    expect(progressLabel("Забираю…", null, t)).toBe("Забираю…");
  });

  it("names Git LFS files plainly in simple mode", () => {
    expect(progressLabel("Забираю…", files, translator("ru", "simple"))).toBe(
      "Скачиваю файлы… 25%",
    );
    expect(progressDetail(files, translator("ru", "simple"), "ru")).toBe(
      "Скачиваю файлы: 3 из 10, 120 из 480 МБ",
    );
    expect(progressDetail(files, translator("en", "full"), "en")).toBe(
      "Downloading LFS files: 3 of 10, 120 of 480 MB",
    );
  });

  it("leaves the size out while nothing is known about it", () => {
    const counted: GitProgress = {
      phase: "download",
      percent: 50,
      files: { done: 1, total: 2 },
      bytes: { done: 0, total: null },
    };
    expect(progressDetail(counted, translator("ru", "simple"), "ru")).toBe(
      "Скачиваю файлы: 1 из 2",
    );
  });

  it("shows sizes in one unit, and bytes alone until the total is known", () => {
    const upload: GitProgress = {
      phase: "upload",
      percent: 40,
      files: { done: 1, total: 4 },
      bytes: { done: 1.25 * 1024 * MiB, total: null },
    };
    expect(progressDetail(upload, translator("ru", "full"), "ru")).toBe(
      "Отправляю файлы LFS: 1 из 4, 1,3 ГБ",
    );
    expect(
      progressDetail(
        { ...upload, bytes: { done: 700 * MiB, total: 2.5 * 1024 * MiB } },
        translator("en", "simple"),
        "en",
      ),
    ).toBe("Sending files: 1 of 4, 0.7 of 2.5 GB");
  });

  it("says what git is doing on the setup screen", () => {
    const resolving: GitProgress = { phase: "resolve", percent: 85 };
    expect(progressDetail(resolving, translator("ru", "simple"), "ru")).toBe(
      "Распаковываю… 85%",
    );
    expect(progressDetail(resolving, translator("en", "full"), "en")).toBe(
      "Resolving deltas… 85%",
    );
  });
});
