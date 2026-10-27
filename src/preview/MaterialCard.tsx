import { lazy, Suspense, useMemo } from "react";
import { ArrowRight, Palette } from "lucide-react";
import { useI18n, type Key } from "../i18n/i18n";
import {
  cssColor,
  diffMaterials,
  knownShader,
  materialLook,
  parseMaterial,
  propertyLabel,
  type Color,
  type MaterialLook,
  type ShaderRef,
} from "../unity/material";
import {
  assetName,
  text,
  textureKey,
  useAssetPaths,
  useTextures,
  type Pair,
  type Revisions,
  type Texture,
} from "./data";

// The sphere preview draws with three.js, which loads only when needed.
const MaterialSpheres = lazy(() => import("./MaterialSpheres"));

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
function TextureValue({
  guid,
  texture,
}: {
  guid?: string | null;
  texture?: Texture | null;
}) {
  const { t } = useI18n();
  if (!guid)
    return <span className="change-value muted">{t("material.none")}</span>;
  return (
    <span className="change-value">
      {texture?.url && (
        <img className="texture-thumb" src={texture.url} alt="" />
      )}
      {texture?.name ?? t("material.textureChanged")}
    </span>
  );
}

function ColorValue({ color }: { color?: Color }) {
  const { t } = useI18n();
  if (!color)
    return <span className="change-value muted">{t("material.none")}</span>;
  return (
    <span className="change-value">
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
  const { before, after, changes } = useMemo(() => {
    const before = pair.before ? parseMaterial(text(pair.before)!) : null;
    const after = pair.after ? parseMaterial(text(pair.after)!) : null;
    return { before, after, changes: diffMaterials(before, after) };
  }, [pair]);

  const paths = useAssetPaths(
    [before, after].flatMap((m) =>
      m && !knownShader(m.shader) ? [m.shader.guid] : [],
    ),
  );
  const shaderName = (shader: ShaderRef) =>
    knownShader(shader) ??
    (paths.has(shader.guid)
      ? assetName(paths.get(shader.guid)!)
      : t("material.packageShader"));
  const looks = {
    before: before && materialLook(before, shaderName(before.shader)),
    after: after && materialLook(after, shaderName(after.shader)),
  };

  const wanted = [
    ...changes.flatMap((c) =>
      c.kind === "texture"
        ? [
            { guid: c.before, revision: revisions.before },
            { guid: c.after, revision: revisions.after },
          ]
        : [],
    ),
    ...(["before", "after"] as const).flatMap((side) =>
      [looks[side]?.map, looks[side]?.normalMap].map((guid) => ({
        guid,
        revision: revisions[side],
      })),
    ),
  ].filter((w): w is { guid: string; revision: string } => !!w.guid);
  const textures = useTextures(wanted);
  const texture = (guid: string | null | undefined, side: keyof Revisions) =>
    guid ? textures.get(textureKey(guid, revisions[side])) : undefined;
  const sphere = (side: keyof Revisions, look: MaterialLook | null) =>
    look && {
      ...look,
      mapUrl: texture(look.map, side)?.url,
      normalUrl: texture(look.normalMap, side)?.url,
    };

  const label = (name: string) => {
    const { key, text } = propertyLabel(name);
    return key ? t(`material.${key}` as Key) : text;
  };
  const shown = after ?? before;
  return (
    <div className="preview card-preview">
      <div className="card-title">
        <Palette />
        <strong>{t("material.title", { name: shown?.name ?? "" })}</strong>
        {shown && (
          <span className="muted card-subtitle">
            {shaderName(shown.shader)}
          </span>
        )}
      </div>
      {(looks.before || looks.after) && (
        <Suspense fallback={<div className="material-spheres" />}>
          <MaterialSpheres
            before={sphere("before", looks.before)}
            after={sphere("after", looks.after)}
          />
        </Suspense>
      )}
      {!changes.length ? (
        <p className="muted">{t("material.noChanges")}</p>
      ) : (
        <div className="change-rows">
          {changes.map((change) => (
            <div className="change-row" key={`${change.kind}-${change.name}`}>
              <span className="change-name">
                {change.kind === "shader"
                  ? t("material.shader")
                  : label(change.name)}
              </span>
              {change.kind === "color" ? (
                <>
                  <ColorValue color={change.before} />
                  <ArrowRight className="change-arrow" />
                  <ColorValue color={change.after} />
                </>
              ) : change.kind === "float" ? (
                <>
                  <span className="change-value">{change.before ?? "—"}</span>
                  <ArrowRight className="change-arrow" />
                  <span className="change-value">{change.after ?? "—"}</span>
                </>
              ) : change.kind === "texture" ? (
                <>
                  <TextureValue
                    guid={change.before}
                    texture={texture(change.before, "before")}
                  />
                  <ArrowRight className="change-arrow" />
                  <TextureValue
                    guid={change.after}
                    texture={texture(change.after, "after")}
                  />
                </>
              ) : (
                <>
                  <span className="change-value">
                    {shaderName(change.before)}
                  </span>
                  <ArrowRight className="change-arrow" />
                  <span className="change-value">
                    {shaderName(change.after)}
                  </span>
                </>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
