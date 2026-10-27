import { describe, expect, it } from "vitest";
import { decodeTga } from "./decode";

function tga(
  type: number,
  depth: number,
  width: number,
  height: number,
  body: number[],
  descriptor = 0,
) {
  const header = new Uint8Array(18);
  header[2] = type;
  header[12] = width;
  header[14] = height;
  header[16] = depth;
  header[17] = descriptor;
  return new Uint8Array([...header, ...body]);
}

const rgba = (pixels: Uint8ClampedArray) =>
  Array.from({ length: pixels.length / 4 }, (_, i) => [
    ...pixels.subarray(i * 4, i * 4 + 4),
  ]);

describe("decodeTga", () => {
  it("reads uncompressed 24-bit rows from the bottom up", () => {
    // Bottom row: blue, green. Top row: red, white. Stored as BGR.
    const image = decodeTga(
      tga(2, 24, 2, 2, [255, 0, 0, 0, 255, 0, 0, 0, 255, 255, 255, 255]),
    );
    expect(image).toMatchObject({ width: 2, height: 2 });
    expect(rgba(image.pixels)).toEqual([
      [255, 0, 0, 255],
      [255, 255, 255, 255],
      [0, 0, 255, 255],
      [0, 255, 0, 255],
    ]);
  });

  it("reads RLE-compressed 32-bit pixels with alpha, top-down", () => {
    // One run of three half-transparent reds, then one raw green pixel.
    const image = decodeTga(
      tga(10, 32, 2, 2, [0x82, 0, 0, 255, 128, 0x00, 0, 255, 0, 255], 0x20),
    );
    expect(rgba(image.pixels)).toEqual([
      [255, 0, 0, 128],
      [255, 0, 0, 128],
      [255, 0, 0, 128],
      [0, 255, 0, 255],
    ]);
  });

  it("reads grayscale masks", () => {
    const image = decodeTga(tga(3, 8, 2, 1, [0, 200]));
    expect(rgba(image.pixels)).toEqual([
      [0, 0, 0, 255],
      [200, 200, 200, 255],
    ]);
  });

  it("refuses formats it doesn't know", () => {
    expect(() => decodeTga(tga(1, 8, 1, 1, [0]))).toThrow("unsupported TGA");
  });
});
