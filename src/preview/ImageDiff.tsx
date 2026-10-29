import { useEffect, useState } from "react";
import { extension } from "../git/paths";
import { useI18n } from "../i18n/i18n";
import { formatSize, useSideLabel, type Pair } from "./data";
import { decodeImage, type DecodedImage } from "./decode";

type Side = DecodedImage | "failed" | null | undefined;

function useDecoded(path: string, bytes: Uint8Array | null) {
  const [image, setImage] = useState<Side>(undefined);
  useEffect(() => {
    let current = true;
    if (!bytes) return setImage(null);
    setImage(undefined);
    decodeImage(path, bytes)
      .then((decoded) => current && setImage(decoded))
      .catch(() => current && setImage("failed"));
    return () => {
      current = false;
    };
  }, [path, bytes]);
  useEffect(
    () => () => {
      if (image && image !== "failed" && image.url.startsWith("blob:"))
        URL.revokeObjectURL(image.url);
    },
    [image],
  );
  return image;
}

type Layout = "side" | "swipe" | "onion";

/** Small textures are blown up by whole pixels, so a 64 px icon is still readable. */
const enlarged = ({ width, height }: DecodedImage) => {
  const zoom = Math.max(1, Math.floor(320 / Math.max(width, height, 1)));
  return { width: width * zoom, height: height * zoom };
};

export function ImageDiff({ path, pair }: { path: string; pair: Pair }) {
  const { t, language } = useI18n();
  const label = useSideLabel();
  const before = useDecoded(path, pair.before);
  const after = useDecoded(path, pair.after);
  const [layout, setLayout] = useState<Layout>("side");
  const [mix, setMix] = useState(50);
  const both = !!pair.before && !!pair.after;
  const ready = (side: Side): side is DecodedImage =>
    !!side && side !== "failed";

  const caption = (side: Side, bytes: Uint8Array | null) =>
    ready(side) && bytes
      ? t("preview.size", {
          width: side.width,
          height: side.height,
          size: formatSize(bytes.length, language),
        })
      : "";
  const resized =
    ready(before) &&
    ready(after) &&
    (before.width !== after.width || before.height !== after.height);

  const panel = (side: Side, bytes: Uint8Array | null, label: string) => (
    <figure className="image-panel">
      <figcaption>
        <strong>{label}</strong>
        <span className={resized ? "resized" : ""}>{caption(side, bytes)}</span>
      </figcaption>
      <div className="checker">
        {side === undefined ? (
          <span className="muted">{t("preview.loading")}</span>
        ) : side === "failed" ? (
          <span className="muted">{t("preview.imageFailed")}</span>
        ) : side ? (
          <img src={side.url} alt={label} style={enlarged(side)} />
        ) : null}
      </div>
    </figure>
  );

  return (
    <div className="preview image-diff">
      {extension(path) === "psd" && (
        <p className="preview-note-line">{t("preview.psdFlat")}</p>
      )}
      {both && (
        <div className="segmented preview-modes">
          {(["side", "swipe", "onion"] as const).map((l) => (
            <button
              key={l}
              className={layout === l ? "active" : ""}
              onClick={() => setLayout(l)}
            >
              {t(
                l === "side"
                  ? "preview.sideBySide"
                  : l === "swipe"
                    ? "preview.swipe"
                    : "preview.onion",
              )}
            </button>
          ))}
        </div>
      )}
      {!both ? (
        panel(
          pair.after ? after : before,
          pair.after ?? pair.before,
          label(pair.after ? "after" : "before", false),
        )
      ) : layout === "side" || !ready(before) || !ready(after) ? (
        <div className="image-pair">
          {panel(before, pair.before, label("before"))}
          {panel(after, pair.after, label("after"))}
        </div>
      ) : (
        <figure className="image-panel">
          <figcaption>
            <strong>
              {label("before")} · {label("after")}
            </strong>
            <span>{caption(after, pair.after)}</span>
          </figcaption>
          <div className="checker stacked">
            <img src={before.url} alt={label("before")} />
            <img
              src={after.url}
              alt={label("after")}
              style={
                layout === "onion"
                  ? { opacity: mix / 100 }
                  : { clipPath: `inset(0 0 0 ${mix}%)` }
              }
            />
            {layout === "swipe" && (
              <span className="swipe-line" style={{ left: `${mix}%` }} />
            )}
          </div>
          <input
            className="mix-slider"
            type="range"
            min={0}
            max={100}
            value={mix}
            aria-label={t(
              layout === "onion" ? "preview.onion" : "preview.swipe",
            )}
            onChange={(e) => setMix(Number(e.target.value))}
          />
        </figure>
      )}
    </div>
  );
}
