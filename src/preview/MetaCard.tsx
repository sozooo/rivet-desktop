import { useMemo, useState } from "react";
import { ArrowRight, Settings2, TriangleAlert } from "lucide-react";
import { fileName } from "../git/paths";
import { useI18n } from "../i18n/i18n";
import { diffMeta, settingLabel, settingValue } from "../unity/meta";
import { text, type Pair } from "./data";

const SHOWN = 12;

/** A .meta file: what changed in how Unity imports its asset. */
export function MetaCard({ path, pair }: { path: string; pair: Pair }) {
  const { t } = useI18n();
  const [all, setAll] = useState(false);
  const diff = useMemo(
    () => diffMeta(text(pair.before), text(pair.after)),
    [pair],
  );
  const asset = fileName(path.replace(/\.meta$/, ""));
  const both = !!pair.before && !!pair.after;
  const value = (key: string, raw: string | null) => {
    if (raw === null || raw === "") return "—";
    const shown = settingValue(key, raw);
    return typeof shown === "boolean"
      ? t(shown ? "preview.on" : "preview.off")
      : shown;
  };
  const rows = all ? diff.changes : diff.changes.slice(0, SHOWN);

  return (
    <div className="preview card-preview">
      <div className="card-title">
        <Settings2 />
        <strong>
          {!pair.before
            ? t("meta.created", { asset })
            : !pair.after
              ? t("meta.removed", { asset })
              : t("preview.meta.importSettings")}
        </strong>
      </div>
      <p className="muted card-hint">{t("preview.meta.hint", { asset })}</p>
      {diff.guidChanged && (
        <p className="card-warning">
          <TriangleAlert />
          {t("meta.guidChanged")}
        </p>
      )}
      {both &&
        (rows.length ? (
          <div className="change-rows">
            {rows.map((change) => (
              <div className="change-row" key={change.key}>
                <span className="change-name" title={change.key}>
                  {settingLabel(change.key)}
                </span>
                <span className="change-value">
                  {value(change.key, change.before)}
                </span>
                <ArrowRight className="change-arrow" />
                <span className="change-value">
                  {value(change.key, change.after)}
                </span>
              </div>
            ))}
          </div>
        ) : (
          !diff.guidChanged && <p className="muted">{t("meta.noSettings")}</p>
        ))}
      {!all && diff.changes.length > SHOWN && (
        <button className="text-button card-more" onClick={() => setAll(true)}>
          {t("preview.showMore", { count: diff.changes.length - SHOWN })}
        </button>
      )}
    </div>
  );
}
