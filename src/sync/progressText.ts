import type { GitProgress } from "../git/progress";
import type { Key, Language, Params } from "../i18n/i18n";

type Translate = (key: Key, params?: Params) => string;

const lfs = (progress: GitProgress) =>
  progress.phase === "download" || progress.phase === "upload";

/**
 * The short label for a button or the top bar: the operation's own word and
 * how far it got ("Забираю… 42%"), or, while Git LFS moves files, that
 * ("Скачиваю файлы… 25%").
 */
export function progressLabel(
  working: string,
  progress: GitProgress | null,
  t: Translate,
) {
  if (!progress) return working;
  const label = lfs(progress)
    ? t(`progress.${progress.phase as "download" | "upload"}`)
    : working;
  return progress.percent === null
    ? label
    : t("progress.percent", { label, percent: progress.percent });
}

/**
 * The whole story for the setup screen and tooltips: the phase with its
 * percent ("Распаковываю… 85%"), or files and sizes ("Скачиваю файлы: 3 из
 * 10, 120 из 480 МБ").
 */
export function progressDetail(
  progress: GitProgress,
  t: Translate,
  language: Language,
) {
  const { files, bytes } = progress;
  if (lfs(progress) && files)
    return t(`progress.${progress.phase as "download" | "upload"}.detail`, {
      done: files.done,
      total: files.total,
      size: sizeSuffix(bytes, t, language),
    });
  const label = t(
    lfs(progress)
      ? `progress.${progress.phase as "download" | "upload"}`
      : `progress.phase.${progress.phase as Exclude<GitProgress["phase"], "download" | "upload">}`,
  );
  return progress.percent === null
    ? label
    : t("progress.percent", { label, percent: progress.percent });
}

const UNITS: Record<Language, string[]> = {
  ru: ["Б", "КБ", "МБ", "ГБ", "ТБ"],
  en: ["B", "KB", "MB", "GB", "TB"],
};

/** ", 120 из 480 МБ" after a file count; nothing while no size is known yet. */
export function sizeSuffix(
  bytes: GitProgress["bytes"],
  t: Translate,
  language: Language,
) {
  return bytes && (bytes.done || bytes.total)
    ? `, ${sizeText(bytes, t, language)}`
    : "";
}

/** "120 из 480 МБ" in one unit, or "120 МБ" while the total is unknown. */
export function sizeText(
  { done, total }: { done: number; total: number | null },
  t: Translate,
  language: Language,
) {
  let unit = 0;
  while ((total ?? done) >= 1024 ** (unit + 1) && unit < 4) unit++;
  const number = (bytes: number) =>
    new Intl.NumberFormat(language, {
      maximumFractionDigits: unit >= 3 ? 1 : 0,
    }).format(bytes / 1024 ** unit);
  const name = UNITS[language][unit];
  return total === null
    ? `${number(done)} ${name}`
    : t("progress.size", {
        done: number(done),
        total: number(total),
        unit: name,
      });
}
