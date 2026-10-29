import { useState } from "react";
import { initials } from "./hooks";

/** A round picture, or initials when there is none or it can't load (offline). */
export function Avatar({
  name,
  url,
  title,
}: {
  name: string;
  url?: string;
  title?: string;
}) {
  const [failed, setFailed] = useState(false);
  return url && !failed ? (
    <img
      className="avatar"
      src={url}
      alt=""
      title={title}
      onError={() => setFailed(true)}
    />
  ) : (
    <span className="avatar" title={title}>
      {initials(name)}
    </span>
  );
}
