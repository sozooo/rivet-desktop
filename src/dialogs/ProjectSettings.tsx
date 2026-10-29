import { useEffect, useState } from "react";
import { Check } from "lucide-react";
import { useI18n } from "../i18n/i18n";
import { findMergeTools, newestTool, type MergeTool } from "../unity/mergeTool";
import type { RepoApi } from "../views/repoApi";
import { useLfsSetup } from "../views/changes/LfsHint";

const On = () => {
  const { t } = useI18n();
  return (
    <span className="project-on">
      <Check size={14} /> {t("settings.on")}
    </span>
  );
};

/** Git LFS and Unity Smart Merge for the open repository: whether they're on, and one click to turn them on. */
export function ProjectSettings({ repo }: { repo: RepoApi }) {
  const { snapshot, act } = repo;
  const { t } = useI18n();
  const lfs = useLfsSetup(repo);
  const [tool, setTool] = useState<MergeTool | null>();
  const unity = snapshot.smartMerge !== undefined;
  useEffect(() => {
    if (unity)
      findMergeTools().then((tools) => setTool(newestTool(tools) ?? null));
  }, [unity]);

  return (
    <div className="project-settings">
      <span className="setting-label">
        {t("settings.project")} · {repo.repository.name}
      </span>
      <div className="project-row">
        <span>{t("settings.lfs")}</span>
        {snapshot.lfs.tracking && snapshot.lfs.installed ? (
          <On />
        ) : snapshot.lfs.installed ? (
          <button className="button" disabled={lfs.busy} onClick={lfs.setup}>
            {t("lfs.setup")}
          </button>
        ) : (
          <span className="muted">{t("lfs.missingTitle")}</span>
        )}
      </div>
      {!snapshot.lfs.installed && (
        <p className="setting-hint">{t("lfs.missing")}</p>
      )}
      {unity && (
        <>
          <div className="project-row">
            <span>{t("settings.smartMerge")}</span>
            {snapshot.smartMerge ? (
              <On />
            ) : (
              <button
                className="button"
                disabled={!tool}
                onClick={() =>
                  tool &&
                  act(
                    (b) => b.setupSmartMerge(tool.path),
                    t("smartMerge.enabled"),
                  )
                }
              >
                {t("settings.turnOn")}
              </button>
            )}
          </div>
          <p className="setting-hint">
            {tool === null
              ? t("smartMerge.noUnity")
              : t("settings.smartMergeHint", { version: tool?.version ?? "…" })}
          </p>
        </>
      )}
    </div>
  );
}
