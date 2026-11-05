import { useState, type CSSProperties } from "react";
import { initials } from "./hooks";

/** Hues that read well as soft backgrounds in both themes. */
const HUES = [8, 28, 45, 88, 140, 168, 196, 220, 255, 290, 325];

/** The same person gets the same colour everywhere and every time. */
export function avatarHue(seed: string) {
  let hash = 0;
  for (const char of seed) hash = (hash * 31 + char.charCodeAt(0)) | 0;
  return HUES[Math.abs(hash) % HUES.length];
}

/**
 * A round picture, or initials when there is none or it can't load (offline).
 * With a `seed` (an email, say), the initials get a colour of their own.
 */
export function Avatar({
  name,
  url,
  title,
  seed,
  className,
}: {
  name: string;
  url?: string;
  title?: string;
  seed?: string;
  className?: string;
}) {
  const [failed, setFailed] = useState<string>();
  const classes = className ? `avatar ${className}` : "avatar";
  return url && failed !== url ? (
    <img
      className={classes}
      src={url}
      alt=""
      title={title}
      onError={() => setFailed(url)}
    />
  ) : (
    <span
      className={classes}
      title={title}
      data-hue={seed === undefined ? undefined : ""}
      style={
        seed === undefined
          ? undefined
          : ({ "--avatar-hue": avatarHue(seed) } as CSSProperties)
      }
    >
      {initials(name)}
    </span>
  );
}
