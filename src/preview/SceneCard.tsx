import { Boxes, CircleMinus, CirclePlus, Dot } from "lucide-react";
import { useI18n } from "../i18n/i18n";
import { diffScenes, type SceneChange } from "../unity/scene";
import { text, type Pair } from "./data";

const vector = (v: number[]) =>
  `(${v.map((n) => Math.round(n * 1000) / 1000).join(", ")})`;

/** "m_CastShadows" → "Cast Shadows". */
const field = (name: string) =>
  name.replace(/^m_/, "").replace(/([a-z])([A-Z])/g, "$1 $2");

export function SceneCard({ pair }: { pair: Pair }) {
  const { t } = useI18n();
  const changes = diffScenes(text(pair.before), text(pair.after));
  const groups = new Map<string, SceneChange[]>();
  for (const change of changes) {
    const list = groups.get(change.path) ?? [];
    list.push(change);
    groups.set(change.path, list);
  }
  const value = (v: string | null) =>
    v === null
      ? t("scene.unset")
      : v.startsWith("ref:")
        ? t("scene.otherAsset")
        : v;

  const describe = (c: SceneChange): string => {
    switch (c.kind) {
      case "added":
        return c.parent
          ? t("scene.added", { parent: c.parent })
          : t("scene.addedRoot");
      case "removed":
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
      case "component-changed":
        return t("scene.componentChanged", {
          component: c.component,
          fields: c.fields.map(field).join(", "),
        });
      case "prefab-added":
        return t("scene.prefabAdded");
      case "prefab-removed":
        return t("scene.prefabRemoved");
      case "override":
        return t("scene.override", {
          property: field(c.property),
          before: value(c.before),
          after: value(c.after),
        });
    }
  };
  const icon = (c: SceneChange) =>
    c.kind === "added" ||
    c.kind === "prefab-added" ||
    c.kind === "component-added" ? (
      <CirclePlus className="scene-added" />
    ) : c.kind === "removed" ||
      c.kind === "prefab-removed" ||
      c.kind === "component-removed" ? (
      <CircleMinus className="scene-removed" />
    ) : (
      <Dot className="scene-changed" />
    );

  return (
    <div className="preview card-preview">
      <div className="card-title">
        <Boxes />
        <strong>
          {groups.size
            ? t("scene.summary", { count: groups.size })
            : t("scene.noChanges")}
        </strong>
      </div>
      <div className="scene-groups">
        {[...groups].map(([path, list]) => {
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
                    {describe(c)}
                  </li>
                ))}
              </ul>
            </section>
          );
        })}
      </div>
    </div>
  );
}
