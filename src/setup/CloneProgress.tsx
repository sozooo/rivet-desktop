import type { GitProgress } from "../git/progress";
import { useI18n } from "../i18n/i18n";
import { progressDetail } from "../sync/progressText";

/**
 * How far a clone got: a bar and what is happening, e.g. "Скачиваю… 42%",
 * then "Скачиваю файлы: 3 из 10, 120 из 480 МБ" for Git LFS files.
 */
export function CloneProgress({ progress }: { progress: GitProgress | null }) {
  const { t, language } = useI18n();
  return (
    <div className="clone-progress" role="status">
      <div className="update-progress">
        <div
          className="update-bar"
          style={{ width: `${progress?.percent ?? 0}%` }}
        />
      </div>
      <p>
        {progress ? progressDetail(progress, t, language) : t("setup.cloning")}
      </p>
    </div>
  );
}
