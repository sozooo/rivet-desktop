import { useEffect, useState } from "react";
import { ArrowRight, Palette } from "lucide-react";
import { fileName } from "../git/paths";
import { useI18n, type Key } from "../i18n/i18n";
import {
  cssColor,
  diffMaterials,
  parseMaterial,
  propertyLabel,
  type Color,
} from "../unity/material";
import { text, useBackend, type Pair, type Revisions } from "./data";
import { decodeImage } from "./decode";

const hex = (c: Color) =>
  "#" +
  [c.r, c.g, c.b]
    .map((v) =>
      Math.round(Math.min(1, Math.max(0, v)) * 255)
        .toString(16)
        .padStart(2, "0"),
    )
    .join("");

/** A texture referenced by GUID: its file name and a thumbnail, when the project has it. */
function TextureChip({
  guid,
  revision,
}: {
  guid?: string | null;
  revision: string;
}) {
  const { t } = useI18n();
  const backend = useBackend();
  const [found, setFound] = useState<{ name: string; url?: string } | null>();
  useEffect(() => {
    let current = true;
    setFound(undefined);
    if (!guid || !backend?.resolveGuid) return setFound(null);
    (async () => {
      const path = await backend.resolveGuid!(guid);
      if (!path) return current && setFound(null);
      const bytes = await backend.readFile(path, revision).catch(() => null);
      const image = bytes
        ? await decodeImage(path, bytes).catch(() => null)
        : null;
      if (current) setFound({ name: fileName(path), url: image?.url });
    })();
    return () => {
      current = false;
    };
  }, [guid, revision, backend]);
  if (!guid)
    return <span className="material-value muted">{t("material.none")}</span>;
  return (
    <span className="material-value">
      {found?.url && <img className="texture-thumb" src={found.url} alt="" />}
      {found?.name ?? t("material.textureChanged")}
    </span>
  );
}

function ColorValue({ color }: { color?: Color }) {
  const { t } = useI18n();
  if (!color)
    return <span className="material-value muted">{t("material.none")}</span>;
  return (
    <span className="material-value">
      <span className="swatch" style={{ background: cssColor(color) }} />
      {hex(color)}
    </span>
  );
}

export function MaterialCard({
  pair,
  revisions,
}: {
  pair: Pair;
  revisions: Revisions;
}) {
  const { t } = useI18n();
  const before = pair.before && parseMaterial(text(pair.before)!);
  const after = pair.after && parseMaterial(text(pair.after)!);
  const changes = diffMaterials(before || null, after || null);
  const label = (name: string) => {
    const { key, text } = propertyLabel(name);
    return key ? t(`material.${key}` as Key) : text;
  };
  return (
    <div className="preview card-preview">
      <div className="card-title">
        <Palette />
        <strong>
          {t("material.title", { name: (after || before)?.name ?? "" })}
        </strong>
      </div>
      {!changes.length ? (
        <p className="muted">{t("material.noChanges")}</p>
      ) : (
        <div className="material-rows">
          {changes.map((change) => (
            <div className="material-row" key={`${change.kind}-${change.name}`}>
              <span className="material-name">
                {change.kind === "shader"
                  ? t("material.shader")
                  : label(change.name)}
              </span>
              {change.kind === "color" ? (
                <>
                  <ColorValue color={change.before} />
                  <ArrowRight className="material-arrow" />
                  <ColorValue color={change.after} />
                </>
              ) : change.kind === "float" ? (
                <>
                  <span className="material-value">{change.before ?? "—"}</span>
                  <ArrowRight className="material-arrow" />
                  <span className="material-value">{change.after ?? "—"}</span>
                </>
              ) : change.kind === "texture" ? (
                <>
                  <TextureChip
                    guid={change.before}
                    revision={revisions.before}
                  />
                  <ArrowRight className="material-arrow" />
                  <TextureChip guid={change.after} revision={revisions.after} />
                </>
              ) : (
                <span className="material-value">
                  {t("material.shaderChanged")}
                </span>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
