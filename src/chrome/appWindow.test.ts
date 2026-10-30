import { describe, expect, it } from "vitest";
import { scaleShortcut, stepScale } from "./appWindow";

const key = (key: string, ctrlKey = true) =>
  ({ key, ctrlKey, altKey: false, metaKey: false }) as KeyboardEvent;

describe("interface size", () => {
  it("steps between sizes and stops at either end", () => {
    expect(stepScale("normal", 1)).toBe("large");
    expect(stepScale("large", 1)).toBe("larger");
    expect(stepScale("larger", 1)).toBe("larger");
    expect(stepScale("large", -1)).toBe("normal");
    expect(stepScale("normal", -1)).toBe("normal");
    expect(stepScale("larger", 0)).toBe("normal");
  });

  it("reads Ctrl + = / + / − / 0 and ignores everything else", () => {
    expect(scaleShortcut(key("="))).toBe(1);
    expect(scaleShortcut(key("+"))).toBe(1);
    expect(scaleShortcut(key("-"))).toBe(-1);
    expect(scaleShortcut(key("0"))).toBe(0);
    expect(scaleShortcut(key("=", false))).toBeNull();
    expect(scaleShortcut(key("s"))).toBeNull();
  });
});
