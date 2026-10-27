import { describe, expect, it } from "vitest";
import { guids } from "../git/mock/assets";
import { diffMeta, settingLabel, settingValue } from "./meta";

const meta = (
  size: number,
  srgb: number,
  guid = guids.barkTexture,
) => `fileFormatVersion: 2
guid: ${guid}
TextureImporter:
  internalIDToNameTable: []
  externalObjects: {}
  serializedVersion: 12
  mipmaps:
    mipMapMode: 0
    enableMipMap: 1
    sRGBTexture: ${srgb}
  textureType: 0
  platformSettings:
  - serializedVersion: 3
    buildTarget: DefaultTexturePlatform
    maxTextureSize: 2048
    textureCompression: 1
  - serializedVersion: 3
    buildTarget: Android
    maxTextureSize: ${size}
    textureCompression: 1
  userData:
  assetBundleName:
`;

describe("import settings", () => {
  it("lists changed settings by platform, as the Inspector names them", () => {
    const diff = diffMeta(meta(2048, 1), meta(512, 0));
    expect(diff.importer).toBe("TextureImporter");
    expect(diff.guidChanged).toBe(false);
    expect(diff.changes).toEqual([
      { key: "mipmaps.sRGBTexture", before: "1", after: "0" },
      {
        key: "platformSettings[Android].maxTextureSize",
        before: "2048",
        after: "512",
      },
    ]);
    expect(diff.changes.map((c) => settingLabel(c.key))).toEqual([
      "sRGB (Color Texture)",
      "Android · Max Size",
    ]);
  });

  it("speaks the Inspector's language for names and values", () => {
    expect(settingValue("mipmaps.sRGBTexture", "0")).toBe(false);
    expect(settingValue("textureType", "1")).toBe("Normal map");
    expect(settingValue("maxTextureSize", "1024")).toBe("1024");
    expect(
      settingLabel("platformSettings[DefaultTexturePlatform].maxTextureSize"),
    ).toBe("Default · Max Size");
    expect(settingLabel("clipAnimations[Run].firstFrame")).toBe("Run · Start");
    expect(settingLabel("someNewSetting")).toBe("Some New Setting");
  });

  it("notices a new GUID, which breaks links to the asset", () => {
    expect(
      diffMeta(meta(512, 1), meta(512, 1, guids.barkNormal)).guidChanged,
    ).toBe(true);
    expect(diffMeta(null, meta(512, 1)).guidChanged).toBe(false);
  });
});
