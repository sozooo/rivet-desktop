import { lazy, Suspense, useContext, useState, type ReactNode } from "react";
import { CloudDownload, CloudOff, FileQuestion, Settings2 } from "lucide-react";
import { looksBinary } from "../git/cli/parse";
import { lfsPointer, type FileKind } from "../git/fileKinds";
import type { FileChange } from "../git/types";
import { useI18n } from "../i18n/i18n";
import { formatSize, PreviewContext, usePair, type Revisions } from "./data";
import { ImageDiff } from "./ImageDiff";
import { MaterialCard } from "./MaterialCard";
import { MetaCard } from "./MetaCard";
import { SceneCard } from "./SceneCard";

// three.js is large; it loads only when a model is opened.
const ModelDiff = lazy(() => import("./ModelDiff"));

function Notice({
  icon,
  title,
  hint,
  action,
}: {
  icon: ReactNode;
  title: string;
  hint?: string;
  action?: ReactNode;
}) {
  return (
    <div className="preview card-preview notice">
      <div className="card-title">
        {icon}
        <strong>{title}</strong>
      </div>
      {hint && <p className="muted">{hint}</p>}
      {action}
    </div>
  );
}

const unityText = new Set<FileKind>([
  "scene",
  "material",
  "unity-yaml",
  "meta",
]);

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
  const { downloadLfs } = useContext(PreviewContext);
  const [downloads, setDownloads] = useState(0);
  const [downloading, setDownloading] = useState(false);
  const pair = usePair(file, revisions, downloads);
  const loading = (
    <div className="preview muted preview-loading">{t("preview.loading")}</div>
  );
  if (!pair) return loading;

  const pointer = lfsPointer(pair.after) ?? lfsPointer(pair.before);
  if (pointer)
    return (
      <Notice
        icon={<CloudOff />}
        title={`${t("preview.lfs")} · ${formatSize(pointer.size, language)}`}
        hint={t("preview.lfsHint")}
        action={
          downloadLfs && (
            <button
              className="button lfs-download"
              disabled={downloading}
              onClick={async () => {
                setDownloading(true);
                await downloadLfs();
                setDownloading(false);
                setDownloads((n) => n + 1);
              }}
            >
              <CloudDownload size={15} />
              {t(downloading ? "lfs.downloading" : "lfs.download")}
            </button>
          )
        }
      />
    );
  if (
    unityText.has(kind) &&
    [pair.before, pair.after].some((bytes) => bytes && looksBinary(bytes))
  )
    return (
      <Notice
        icon={<FileQuestion />}
        title={t("preview.unityBinary")}
        hint={t("preview.unityBinaryHint")}
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
      return <MetaCard path={file.path} pair={pair} />;
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
