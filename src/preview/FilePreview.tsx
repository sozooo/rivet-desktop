import { lazy, Suspense } from "react";
import { CloudOff, FileQuestion, Settings2 } from "lucide-react";
import { fileName } from "../git/paths";
import { isLfsPointer, type FileKind } from "../git/fileKinds";
import type { FileChange } from "../git/types";
import { useI18n } from "../i18n/i18n";
import { formatSize, usePair, type Revisions } from "./data";
import { ImageDiff } from "./ImageDiff";
import { MaterialCard } from "./MaterialCard";
import { SceneCard } from "./SceneCard";

// three.js is large; it loads only when a model is opened.
const ModelDiff = lazy(() => import("./ModelDiff"));

function Notice({
  icon,
  title,
  hint,
}: {
  icon: React.ReactNode;
  title: string;
  hint?: string;
}) {
  return (
    <div className="preview card-preview notice">
      <div className="card-title">
        {icon}
        <strong>{title}</strong>
      </div>
      {hint && <p className="muted">{hint}</p>}
    </div>
  );
}

/** A visual or readable view of a non-code file, comparing two versions. */
export function FilePreview({
  file,
  kind,
  revisions,
}: {
  file: FileChange;
  kind: FileKind;
  revisions: Revisions;
}) {
  const { t, language } = useI18n();
  const pair = usePair(file, revisions);
  const loading = (
    <div className="preview muted preview-loading">{t("preview.loading")}</div>
  );
  if (!pair) return loading;

  if (isLfsPointer(pair.before) || isLfsPointer(pair.after))
    return (
      <Notice
        icon={<CloudOff />}
        title={t("preview.lfs")}
        hint={t("preview.lfsHint")}
      />
    );

  switch (kind) {
    case "image":
      return <ImageDiff path={file.path} pair={pair} />;
    case "model":
      return (
        <Suspense fallback={loading}>
          <ModelDiff path={file.path} pair={pair} />
        </Suspense>
      );
    case "material":
      return <MaterialCard pair={pair} revisions={revisions} />;
    case "scene":
      return <SceneCard pair={pair} />;
    case "meta":
      return (
        <Notice
          icon={<Settings2 />}
          title={t("preview.meta.importSettings")}
          hint={t("preview.meta.hint", {
            asset: fileName(file.path.replace(/\.meta$/, "")),
          })}
        />
      );
    case "unity-yaml":
      return (
        <Notice
          icon={<Settings2 />}
          title={t("preview.unityData")}
          hint={t("preview.unityDataHint")}
        />
      );
    default: {
      const sizes = [pair.before, pair.after]
        .filter((b): b is Uint8Array => !!b)
        .map((b) => formatSize(b.length, language))
        .join(" → ");
      return (
        <Notice
          icon={<FileQuestion />}
          title={`${t("preview.binary")} · ${sizes}`}
          hint={t("preview.noPreview")}
        />
      );
    }
  }
}
