import { useMemo, useState } from "react";
import { Boxes, CircleMinus, CirclePlus, Dot } from "lucide-react";
import { fileName } from "../git/paths";
import { useI18n } from "../i18n/i18n";
import {
  diffSceneModels,
  parseScene,
  sceneGuids,
  type FieldChange,
  type FieldValue,
  type SceneChange,
} from "../unity/scene";
import { text, useAssetPaths, type Pair } from "./data";

const GROUPS = 150;

const vector = (v: number[]) =>
  `(${v.map((n) => Math.round(n * 1000) / 1000).join(", ")})`;

/** "m_CastShadows" → "Cast Shadows", "m_Settings.m_Speed" → "Settings · Speed". */
const field = (name: string) =>
  name
    .replace(/\.Array\.data\[\d+\]/g, "")
    .replace(/\[\d+\]/g, "")
    .split(".")
    .map((part) =>
      part
        .replace(/^m_/, "")
        .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
        .replace(/^./, (c) => c.toUpperCase()),
    )
    .join(" · ");

const assetGuids = (changes: SceneChange[]) =>
  changes.flatMap((c) => {
    const values =
      c.kind === "override"
        ? [c.before, c.after]
        : c.kind === "fields" || c.kind === "settings"
          ? c.fields.flatMap((f) =>
              f.values ? [f.values.before, f.values.after] : [],
            )
          : [];
    return values.flatMap((v) => (v && "asset" in v ? [v.asset] : []));
  });

/** A scene or prefab as a list of object changes, grouped by object. */
export function SceneCard({ pair }: { pair: Pair }) {
  const { t } = useI18n();
  const [all, setAll] = useState(false);
  const models = useMemo(
    () => ({
      before: parseScene(text(pair.before)),
      after: parseScene(text(pair.after)),
    }),
    [pair],
  );
  // Prefabs, scripts and materials are known by GUID; their file names read better.
  const guids = useMemo(
    () => [
      ...sceneGuids(models.before),
      ...sceneGuids(models.after),
      ...assetGuids(diffSceneModels(models.before, models.after)),
    ],
    [models],
  );
  const assets = useAssetPaths(guids);
  const changes = useMemo(
    () => diffSceneModels(models.before, models.after, assets),
    [models, assets],
  );
  const groups = new Map<string, SceneChange[]>();
  for (const change of changes) {
    const list = groups.get(change.path) ?? [];
    list.push(change);
    groups.set(change.path, list);
  }

  const value = (v: FieldValue, name: string): string => {
    if (!v) return t("scene.unset");
    if ("text" in v) {
      if (/(Enabled|IsActive)$/.test(name) && /^[01]$/.test(v.text))
        return t(v.text === "1" ? "preview.on" : "preview.off");
      return v.text === "" ? "—" : v.text;
    }
    if ("object" in v) return v.object || t("scene.otherObject");
    if (/^0{16}[ef]0{15}$/.test(v.asset)) return t("scene.builtIn");
    return assets.has(v.asset)
      ? fileName(assets.get(v.asset)!)
      : t("scene.otherAsset");
  };
  const fields = (list: FieldChange[]) =>
    list
      .map((f) =>
        f.values
          ? `${field(f.name)} ${value(f.values.before, f.name)} → ${value(f.values.after, f.name)}`
          : field(f.name),
      )
      .join("; ");
  const property = (path: string) => {
    const axis = path.match(
      /^m_Local(Position|EulerAnglesHint|Scale)\.([xyz])$/,
    );
    if (!axis) return field(path);
    const kind =
      axis[1] === "Position"
        ? "scene.axis.position"
        : axis[1] === "Scale"
          ? "scene.axis.scale"
          : "scene.axis.rotation";
    return t(kind, { axis: axis[2].toUpperCase() });
  };

  const describe = (c: SceneChange): string => {
    switch (c.kind) {
      case "added":
        if (c.prefab)
          return c.parent
            ? t("scene.prefabAddedUnder", { parent: c.parent })
            : t("scene.prefabAdded");
        return c.parent
          ? t("scene.added", { parent: c.parent })
          : t("scene.addedRoot");
      case "removed":
        if (c.prefab) return t("scene.prefabRemoved");
        return c.parent
          ? t("scene.removed", { parent: c.parent })
          : t("scene.removedRoot");
      case "renamed":
        return t("scene.renamed", { before: c.before, after: c.after });
      case "reparented":
        return t("scene.reparented", {
          before: c.before || t("scene.top"),
          after: c.after || t("scene.top"),
        });
      case "active":
        return t(c.after ? "scene.on" : "scene.off");
      case "position":
      case "rotation":
      case "scale":
        return t(`scene.${c.kind}`, {
          before: vector(c.before),
          after: vector(c.after),
        });
      case "component-added":
        return t("scene.componentAdded", { component: c.component });
      case "component-removed":
        return t("scene.componentRemoved", { component: c.component });
      case "fields":
        return c.component
          ? t("scene.componentChanged", {
              component: c.component,
              fields: fields(c.fields),
            })
          : fields(c.fields);
      case "settings":
        return fields(c.fields);
      case "override":
        return t("scene.override", {
          property: property(c.property),
          before: value(c.before, c.property),
          after: value(c.after, c.property),
        });
    }
  };
  const icon = (c: SceneChange) =>
    c.kind === "added" || c.kind === "component-added" ? (
      <CirclePlus className="scene-added" />
    ) : c.kind === "removed" || c.kind === "component-removed" ? (
      <CircleMinus className="scene-removed" />
    ) : (
      <Dot className="scene-changed" />
    );

  const shown = all ? [...groups] : [...groups].slice(0, GROUPS);
  const objects = [...groups.values()].filter((list) =>
    list.some((c) => c.kind !== "settings"),
  ).length;
  return (
    <div className="preview card-preview">
      <div className="card-title">
        <Boxes />
        <strong>
          {objects
            ? t("scene.summary", { count: objects })
            : groups.size
              ? t("scene.settingsOnly")
              : t("scene.noChanges")}
        </strong>
      </div>
      <div className="scene-groups">
        {shown.map(([path, list]) => {
          const parts = path.split("/");
          return (
            <section className="scene-group" key={path}>
              <h4 title={path}>
                {parts.length > 1 && (
                  <span className="muted">
                    {parts.slice(0, -1).join(" / ")} /{" "}
                  </span>
                )}
                {parts[parts.length - 1]}
              </h4>
              <ul>
                {list.map((c, i) => (
                  <li key={i}>
                    {icon(c)}
                    <span>{describe(c)}</span>
                  </li>
                ))}
              </ul>
            </section>
          );
        })}
      </div>
      {shown.length < groups.size && (
        <button className="text-button card-more" onClick={() => setAll(true)}>
          {t("preview.showMore", { count: groups.size - shown.length })}
        </button>
      )}
    </div>
  );
}
