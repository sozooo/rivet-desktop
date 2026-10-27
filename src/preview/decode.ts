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
  if (ext === "tga") return fromCanvas(decodeTga(bytes));
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
  await image.decode();
  return { url, width: image.naturalWidth, height: image.naturalHeight };
}

function fromCanvas(canvas: HTMLCanvasElement): DecodedImage {
  return {
    url: canvas.toDataURL(),
    width: canvas.width,
    height: canvas.height,
  };
}

/** Truevision TGA: uncompressed or RLE, 24 or 32 bits, as Unity projects use it. */
export function decodeTga(bytes: Uint8Array): HTMLCanvasElement {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const idLength = bytes[0];
  const type = bytes[2];
  const width = view.getUint16(12, true);
  const height = view.getUint16(14, true);
  const depth = bytes[16];
  const descriptor = bytes[17];
  if ((type !== 2 && type !== 10) || (depth !== 24 && depth !== 32))
    throw new Error(`unsupported TGA (type ${type}, ${depth} bits)`);
  const pixelSize = depth / 8;
  const pixels = new Uint8ClampedArray(width * height * 4);
  let offset = 18 + idLength;
  const put = (index: number, at: number) => {
    pixels[index * 4] = bytes[at + 2];
    pixels[index * 4 + 1] = bytes[at + 1];
    pixels[index * 4 + 2] = bytes[at];
    pixels[index * 4 + 3] = pixelSize === 4 ? bytes[at + 3] : 255;
  };
  for (let i = 0; i < width * height;) {
    if (type === 2) {
      put(i++, offset);
      offset += pixelSize;
      continue;
    }
    const packet = bytes[offset++];
    const count = (packet & 0x7f) + 1;
    if (packet & 0x80) {
      for (let n = 0; n < count; n++) put(i++, offset);
      offset += pixelSize;
    } else
      for (let n = 0; n < count; n++) {
        put(i++, offset);
        offset += pixelSize;
      }
  }
  // TGA rows start at the bottom unless bit 5 of the descriptor says otherwise.
  const topDown = (descriptor & 0x20) !== 0;
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const image = new ImageData(width, height);
  for (let y = 0; y < height; y++) {
    const row = topDown ? y : height - 1 - y;
    image.data.set(
      pixels.subarray(row * width * 4, (row + 1) * width * 4),
      y * width * 4,
    );
  }
  canvas.getContext("2d")!.putImageData(image, 0, 0);
  return canvas;
}
