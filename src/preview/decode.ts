import { extension } from "../git/paths";

export type DecodedImage = { url: string; width: number; height: number };

const mime: Record<string, string> = {
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  gif: "image/gif",
  bmp: "image/bmp",
};

/** Turns image bytes into something an <img> can show. Rejects when it can't. */
export async function decodeImage(
  path: string,
  bytes: Uint8Array,
): Promise<DecodedImage> {
  const ext = extension(path);
  if (ext === "tga") return fromPixels(decodeTga(bytes));
  if (ext === "psd") {
    const { readPsd } = await import("ag-psd");
    const psd = readPsd(
      bytes.buffer.slice(
        bytes.byteOffset,
        bytes.byteOffset + bytes.byteLength,
      ) as ArrayBuffer,
      {
        skipLayerImageData: true,
        skipThumbnail: true,
      },
    );
    if (!psd.canvas) throw new Error("no composite image");
    return fromCanvas(psd.canvas as HTMLCanvasElement);
  }
  const blob = new Blob([bytes as BlobPart], {
    type: mime[ext] ?? "application/octet-stream",
  });
  const url = URL.createObjectURL(blob);
  const image = new Image();
  image.src = url;
  try {
    await image.decode();
  } catch (error) {
    URL.revokeObjectURL(url);
    throw error;
  }
  return { url, width: image.naturalWidth, height: image.naturalHeight };
}

function fromCanvas(canvas: HTMLCanvasElement): DecodedImage {
  return {
    url: canvas.toDataURL(),
    width: canvas.width,
    height: canvas.height,
  };
}

function fromPixels({ width, height, pixels }: Pixels) {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const image = new ImageData(width, height);
  image.data.set(pixels);
  canvas.getContext("2d")!.putImageData(image, 0, 0);
  return fromCanvas(canvas);
}

export type Pixels = {
  width: number;
  height: number;
  pixels: Uint8ClampedArray;
};

/**
 * Truevision TGA as Unity projects use it: true-color (16, 24 or 32 bits) or
 * grayscale, plain or RLE-compressed. Returns RGBA rows from the top.
 */
export function decodeTga(bytes: Uint8Array): Pixels {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const idLength = bytes[0];
  const type = bytes[2];
  const width = view.getUint16(12, true);
  const height = view.getUint16(14, true);
  const depth = bytes[16];
  const descriptor = bytes[17];
  const gray = type === 3 || type === 11;
  if (
    ![2, 3, 10, 11].includes(type) ||
    (gray ? depth !== 8 : ![16, 24, 32].includes(depth))
  )
    throw new Error(`unsupported TGA (type ${type}, ${depth} bits)`);
  const pixelSize = depth / 8;
  const pixels = new Uint8ClampedArray(width * height * 4);
  // TGA rows start at the bottom unless bit 5 of the descriptor says otherwise.
  const topDown = (descriptor & 0x20) !== 0;
  const put = (index: number, at: number) => {
    const row = Math.floor(index / width);
    const o =
      ((topDown ? row : height - 1 - row) * width + (index % width)) * 4;
    if (gray) {
      pixels[o] = pixels[o + 1] = pixels[o + 2] = bytes[at];
      pixels[o + 3] = 255;
    } else if (pixelSize === 2) {
      // 5 bits per channel; the attribute bit is unreliable, so 16-bit images are opaque.
      const v = bytes[at] | (bytes[at + 1] << 8);
      pixels[o] = (((v >> 10) & 31) * 255) / 31;
      pixels[o + 1] = (((v >> 5) & 31) * 255) / 31;
      pixels[o + 2] = ((v & 31) * 255) / 31;
      pixels[o + 3] = 255;
    } else {
      pixels[o] = bytes[at + 2];
      pixels[o + 1] = bytes[at + 1];
      pixels[o + 2] = bytes[at];
      pixels[o + 3] = pixelSize === 4 ? bytes[at + 3] : 255;
    }
  };
  let offset =
    18 +
    idLength +
    (bytes[1] ? view.getUint16(5, true) * Math.ceil(bytes[7] / 8) : 0);
  const rle = type >= 9;
  for (let i = 0; i < width * height && offset < bytes.length;) {
    if (!rle) {
      put(i++, offset);
      offset += pixelSize;
      continue;
    }
    const packet = bytes[offset++];
    const count = Math.min((packet & 0x7f) + 1, width * height - i);
    if (packet & 0x80) {
      for (let n = 0; n < count; n++) put(i++, offset);
      offset += pixelSize;
    } else
      for (let n = 0; n < count; n++) {
        put(i++, offset);
        offset += pixelSize;
      }
  }
  return { width, height, pixels };
}
