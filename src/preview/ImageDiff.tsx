import { useEffect, useState } from "react";
import { extension } from "../git/paths";
import { useI18n } from "../i18n/i18n";
import { formatSize, type Pair } from "./data";
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

export function ImageDiff({ path, pair }: { path: string; pair: Pair }) {
  const { t, language } = useI18n();
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

  const panel = (side: Side, bytes: Uint8Array | null, label: string) => (
    <figure className="image-panel">
      <figcaption>
        <strong>{label}</strong>
        <span>{caption(side, bytes)}</span>
      </figcaption>
      <div className="checker">
        {side === undefined ? (
          <span className="muted">{t("preview.loading")}</span>
        ) : side === "failed" ? (
          <span className="muted">{t("preview.imageFailed")}</span>
        ) : side ? (
          <img src={side.url} alt={label} />
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
          t(pair.after ? "preview.added" : "preview.deleted"),
        )
      ) : layout === "side" || !ready(before) || !ready(after) ? (
        <div className="image-pair">
          {panel(before, pair.before, t("preview.before"))}
          {panel(after, pair.after, t("preview.after"))}
        </div>
      ) : (
        <figure className="image-panel">
          <figcaption>
            <strong>
              {t("preview.before")} · {t("preview.after")}
            </strong>
            <span>{caption(after, pair.after)}</span>
          </figcaption>
          <div className="checker stacked">
            <img src={before.url} alt={t("preview.before")} />
            <img
              src={after.url}
              alt={t("preview.after")}
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
