import { describe, expect, it } from "vitest";
import { en } from "./en";
import { timeAgo, translate } from "./i18n";
import { ru } from "./ru";

describe("translate", () => {
  it("picks Russian plural forms", () => {
    const files = (count: number) =>
      translate("ru", "full", "common.files", { count });
    expect([1, 2, 5, 11, 21, 22, 25].map(files)).toEqual([
      "1 файл",
      "2 файла",
      "5 файлов",
      "11 файлов",
      "21 файл",
      "22 файла",
      "25 файлов",
    ]);
    expect(translate("en", "full", "common.files", { count: 1 })).toBe(
      "1 file",
    );
    expect(translate("en", "full", "common.files", { count: 3 })).toBe(
      "3 files",
    );
  });

  it("uses simple-mode wording when there is one", () => {
    expect(translate("ru", "simple", "composer.button")).toBe(
      "Сохранить версию",
    );
    expect(translate("ru", "full", "composer.button")).toBe("Закоммитить");
    // No simple variant: the regular message.
    expect(translate("ru", "simple", "nav.history")).toBe("История");
  });

  it("fills in parameters and leaves unknown ones visible", () => {
    expect(translate("en", "full", "load.title", { name: "kinetic" })).toBe(
      "Couldn't open kinetic",
    );
    expect(translate("en", "full", "load.title")).toBe("Couldn't open {name}");
  });

  it("has the same keys in every language", () => {
    expect(Object.keys(ru).sort()).toEqual(Object.keys(en).sort());
  });
});

describe("timeAgo", () => {
  it("speaks the chosen language", () => {
    const now = Date.now();
    expect(timeAgo("ru", now - 5 * 60_000, now)).toBe("5 минут назад");
    expect(timeAgo("en", now - 2 * 3_600_000, now)).toBe("2 hours ago");
    expect(timeAgo("ru", now, now)).toBe("только что");
  });
});
