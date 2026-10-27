import {
  asList,
  asText,
  isMap,
  parseUnityYaml,
  reference,
  type UnityDocument,
  type YamlMap,
  type YamlValue,
} from "./yaml";

export type Vector = [number, number, number];

/** A value as people read it: text, another asset (by GUID), or an object in the same file. */
export type FieldValue =
  { text: string } | { asset: string } | { object: string } | null;

/** A changed field; its values are known when exactly one value in it changed. */
export type FieldChange = {
  name: string;
  values?: { before: FieldValue; after: FieldValue };
};

type Leaf = { text: string } | { ref: { fileId: string; guid: string } };

type Component = {
  fileId: string;
  type: string;
  /** The script asset of a MonoBehaviour. */
  script?: string;
  data: YamlMap;
};

export type SceneObject = {
  fileId: string;
  /** Empty for a placed prefab that keeps its prefab's name. */
  name: string;
  active: boolean;
  parent: string | null;
  position?: Vector;
  rotation?: Vector;
  scale?: Vector;
  /** GameObject fields besides name, activity and components: tag, layer, static flags. */
  data: YamlMap;
  components: Component[];
  /** A prefab placed in this file: which prefab, and what was changed on this copy. */
  prefab?: {
    source: string;
    /** The source object whose transform is this copy's own; its overrides read as a move. */
    root?: string;
    /** The override that names this copy. */
    nameKey?: string;
    modifications: Map<string, Leaf>;
  };
};

export type SceneModel = {
  objects: Map<string, SceneObject>;
  /** Every document that belongs to an object (components, stand-ins) → that object. */
  owners: Map<string, string>;
  /** File-wide settings such as RenderSettings and LightmapSettings. */
  settings: Map<string, { type: string; data: YamlMap }>;
};

/** One readable change, keyed by the object path it belongs to. */
export type SceneChange =
  | { kind: "added" | "removed"; path: string; parent: string; prefab: boolean }
  | { kind: "renamed"; path: string; before: string; after: string }
  | { kind: "reparented"; path: string; before: string; after: string }
  | { kind: "active"; path: string; after: boolean }
  | {
      kind: "position" | "rotation" | "scale";
      path: string;
      before: Vector;
      after: Vector;
    }
  | {
      kind: "component-added" | "component-removed";
      path: string;
      component: string;
    }
  | {
      /** Changed fields of a component, or of the object itself (tag, layer…). */
      kind: "fields";
      path: string;
      component?: string;
      fields: FieldChange[];
    }
  | { kind: "settings"; path: string; fields: FieldChange[] }
  | {
      kind: "override";
      path: string;
      property: string;
      before: FieldValue;
      after: FieldValue;
    };

const TRANSFORM_TYPES = new Set(["Transform", "RectTransform"]);
const IGNORED_FIELDS = new Set([
  "m_ObjectHideFlags",
  "m_CorrespondingSourceObject",
  "m_PrefabInstance",
  "m_PrefabAsset",
  "m_PrefabParentObject",
  "m_PrefabInternal",
  "m_GameObject",
  "m_EditorHideFlags",
  "m_EditorClassIdentifier",
  "m_SceneGUID",
  "serializedVersion",
]);
/** Documents that only mirror what the objects already say. */
const IGNORED_DOCUMENTS = new Set(["SceneRoots", "Prefab"]);
const TRANSFORM_OVERRIDE =
  /^m_Local(Position|Rotation|Scale|EulerAnglesHint)\.[xyzw]$/;

const number = (value: YamlValue | undefined) => Number(asText(value));

const vector = (value: YamlValue | undefined): Vector | undefined =>
  isMap(value)
    ? [number(value.x), number(value.y), number(value.z)]
    : undefined;

/** Unity stores rotations as quaternions; people think in degrees. */
function euler([x, y, z, w]: number[]): Vector {
  const deg = (r: number) => Math.round(((r * 180) / Math.PI) * 100) / 100;
  // Unity applies Z, then X, then Y.
  const sinX = 2 * (w * x - y * z);
  const pitch =
    Math.abs(sinX) >= 1 ? (Math.sign(sinX) * Math.PI) / 2 : Math.asin(sinX);
  const yaw = Math.atan2(2 * (w * y + x * z), 1 - 2 * (x * x + y * y));
  const roll = Math.atan2(2 * (w * z + x * y), 1 - 2 * (x * x + z * z));
  return [deg(pitch), deg(yaw), deg(roll)].map((v) =>
    Object.is(v, -0) ? 0 : v,
  ) as Vector;
}

const quaternion = (value: YamlValue | undefined) =>
  isMap(value)
    ? euler(["x", "y", "z", "w"].map((k) => number(value[k])))
    : undefined;

function modificationsOf(modification: YamlValue | undefined) {
  const result = new Map<string, Leaf>();
  const list = isMap(modification) ? modification.m_Modifications : undefined;
  for (const item of asList(list)) {
    if (!isMap(item)) continue;
    const target = reference(item.target)?.fileId ?? "";
    const ref = isMap(item.objectReference) ? item.objectReference : {};
    const fileId = asText(ref.fileID);
    result.set(
      `${target}:${asText(item.propertyPath)}`,
      fileId && fileId !== "0"
        ? { ref: { fileId, guid: asText(ref.guid) } }
        : { text: asText(item.value) },
    );
  }
  return result;
}

/** The prefab object whose transform is overridden as a whole: the placed copy's root. */
function rootTarget(modifications: Map<string, Leaf>) {
  const targets = new Set<string>();
  for (const key of modifications.keys()) {
    const [target, property] = splitKey(key);
    if (property === "m_RootOrder") return target;
    if (TRANSFORM_OVERRIDE.test(property)) targets.add(target);
  }
  return targets.size === 1 ? [...targets][0] : undefined;
}

const splitKey = (key: string) => {
  const colon = key.indexOf(":");
  return [key.slice(0, colon), key.slice(colon + 1)];
};

/** A transform vector written as overrides, when every axis of it is there. */
function overriddenVector(
  modifications: Map<string, Leaf>,
  target: string,
  property: string,
  axes = ["x", "y", "z"],
) {
  const values = axes.map((axis) => {
    const leaf = modifications.get(`${target}:${property}.${axis}`);
    return leaf && "text" in leaf ? Number(leaf.text) : NaN;
  });
  return values.some(Number.isNaN) ? undefined : (values as Vector);
}

function placedPrefab(doc: UnityDocument): SceneObject {
  const modifications = modificationsOf(doc.data.m_Modification);
  const root = rootTarget(modifications);
  const nameKey = [...modifications.keys()].find((key) =>
    key.endsWith(":m_Name"),
  );
  const name = nameKey ? modifications.get(nameKey) : undefined;
  const object: SceneObject = {
    fileId: doc.fileId,
    name: name && "text" in name ? name.text : "",
    active: true,
    parent: null,
    data: {},
    components: [],
    prefab: {
      source: reference(doc.data.m_SourcePrefab)?.guid ?? "",
      root,
      nameKey,
      modifications,
    },
  };
  if (!root) return object;
  const rotation = overriddenVector(modifications, root, "m_LocalRotation", [
    "x",
    "y",
    "z",
    "w",
  ]);
  object.position = overriddenVector(modifications, root, "m_LocalPosition");
  object.rotation = rotation
    ? euler(rotation)
    : overriddenVector(modifications, root, "m_LocalEulerAnglesHint");
  object.scale = overriddenVector(modifications, root, "m_LocalScale");
  return object;
}

function buildScene(documents: UnityDocument[]): SceneModel {
  const objects = new Map<string, SceneObject>();
  const owners = new Map<string, string>();
  const settings = new Map<string, { type: string; data: YamlMap }>();

  // Placed prefabs come first: their stand-in ("stripped") documents point at them.
  const placed = new Map(
    documents
      .filter((doc) => doc.type === "PrefabInstance" && !doc.stripped)
      .map((doc) => [doc.fileId, placedPrefab(doc)]),
  );
  for (const doc of documents) {
    if (doc.stripped) {
      const instance =
        reference(doc.data.m_PrefabInstance)?.fileId ??
        reference(doc.data.m_PrefabInternal)?.fileId;
      if (instance && placed.has(instance)) owners.set(doc.fileId, instance);
    } else if (placed.has(doc.fileId)) {
      objects.set(doc.fileId, placed.get(doc.fileId)!);
      owners.set(doc.fileId, doc.fileId);
    } else if (doc.classId === 1) {
      const data = { ...doc.data };
      for (const key of ["m_Name", "m_IsActive", "m_Component"])
        delete data[key];
      objects.set(doc.fileId, {
        fileId: doc.fileId,
        name: asText(doc.data.m_Name) || "GameObject",
        active: asText(doc.data.m_IsActive) !== "0",
        parent: null,
        data,
        components: [],
      });
      owners.set(doc.fileId, doc.fileId);
    }
  }

  const transforms: UnityDocument[] = [];
  for (const doc of documents) {
    if (doc.stripped || owners.has(doc.fileId)) continue;
    const gameObject = reference(doc.data.m_GameObject)?.fileId;
    if (!gameObject) {
      if (
        doc.type &&
        !IGNORED_DOCUMENTS.has(doc.type) &&
        doc.type !== "PrefabInstance"
      )
        settings.set(doc.fileId, { type: doc.type, data: doc.data });
      continue;
    }
    const owner = owners.get(gameObject);
    if (!owner) continue;
    const object = objects.get(owner)!;
    owners.set(doc.fileId, owner);
    if (TRANSFORM_TYPES.has(doc.type) && !object.prefab) {
      transforms.push(doc);
      object.position = vector(doc.data.m_LocalPosition);
      object.rotation = quaternion(doc.data.m_LocalRotation);
      object.scale = vector(doc.data.m_LocalScale);
    } else {
      // Components added to a placed prefab belong to that prefab copy.
      object.components.push({
        fileId: doc.fileId,
        type: doc.type,
        script:
          doc.type === "MonoBehaviour"
            ? reference(doc.data.m_Script)?.guid
            : undefined,
        data: doc.data,
      });
    }
  }
  // Parents are known once every transform has an owner.
  for (const doc of transforms) {
    const father = reference(doc.data.m_Father)?.fileId;
    objects.get(owners.get(doc.fileId)!)!.parent =
      (father && owners.get(father)) || null;
  }
  for (const doc of documents) {
    if (doc.type !== "PrefabInstance" || doc.stripped) continue;
    const modification = isMap(doc.data.m_Modification)
      ? doc.data.m_Modification
      : {};
    const parent = reference(modification.m_TransformParent)?.fileId;
    objects.get(doc.fileId)!.parent = (parent && owners.get(parent)) || null;
  }
  return { objects, owners, settings };
}

export const parseScene = (text: string | null) =>
  buildScene(text ? parseUnityYaml(text) : []);

/** Assets a scene names by GUID: placed prefabs and scripts, for friendlier labels. */
export function sceneGuids(model: SceneModel) {
  const guids = new Set<string>();
  for (const object of model.objects.values()) {
    if (object.prefab?.source) guids.add(object.prefab.source);
    for (const component of object.components)
      if (component.script) guids.add(component.script);
  }
  return guids;
}

const baseName = (path: string) =>
  path.slice(path.lastIndexOf("/") + 1).replace(/\.[^.]*$/, "");

function leaves(value: YamlValue, prefix: string, out: Map<string, Leaf>) {
  if (typeof value === "string") out.set(prefix, { text: value });
  else if (Array.isArray(value))
    value.forEach((v, i) => leaves(v, `${prefix}[${i}]`, out));
  else if ("fileID" in value)
    out.set(prefix, {
      ref: { fileId: asText(value.fileID), guid: asText(value.guid) },
    });
  else if (
    Object.keys(value).length &&
    Object.entries(value).every(
      ([k, v]) => /^[xyzwrgba]$/.test(k) && typeof v === "string",
    )
  )
    // Vectors and colors read as one value.
    out.set(prefix, { text: `(${Object.values(value).join(", ")})` });
  else
    for (const [k, v] of Object.entries(value)) {
      if (!prefix && IGNORED_FIELDS.has(k)) continue;
      leaves(v, prefix ? `${prefix}.${k}` : k, out);
    }
}

const leafKey = (leaf?: Leaf) =>
  !leaf
    ? undefined
    : "text" in leaf
      ? leaf.text
      : `${leaf.ref.fileId}:${leaf.ref.guid}`;

export function diffSceneModels(
  before: SceneModel,
  after: SceneModel,
  /** Asset paths by GUID, as far as they are known. */
  assets: Map<string, string> = new Map(),
): SceneChange[] {
  const nameOf = (object: SceneObject) =>
    object.name ||
    (object.prefab && assets.has(object.prefab.source)
      ? baseName(assets.get(object.prefab.source)!)
      : "Prefab");
  const pathOf = (model: SceneModel, id: string | null) => {
    const names: string[] = [];
    const seen = new Set<string>();
    while (id && !seen.has(id)) {
      seen.add(id);
      const object = model.objects.get(id);
      if (!object) break;
      names.unshift(nameOf(object));
      id = object.parent;
    }
    return names.join("/");
  };
  const componentName = (c: Component) =>
    c.type !== "MonoBehaviour"
      ? c.type
      : c.script && assets.has(c.script)
        ? baseName(assets.get(c.script)!)
        : "Script";
  const value = (model: SceneModel, leaf?: Leaf): FieldValue => {
    if (!leaf) return null;
    if ("text" in leaf) return { text: leaf.text };
    const { fileId, guid } = leaf.ref;
    if (guid) return { asset: guid };
    if (!fileId || fileId === "0") return null;
    const owner = model.owners.get(fileId);
    return { object: owner ? pathOf(model, owner) : "" };
  };
  const changedFields = (a: YamlMap, b: YamlMap): FieldChange[] => {
    const old = new Map<string, Leaf>(),
      now = new Map<string, Leaf>();
    leaves(a, "", old);
    leaves(b, "", now);
    const byField = new Map<string, string[]>();
    for (const key of new Set([...old.keys(), ...now.keys()]))
      if (leafKey(old.get(key)) !== leafKey(now.get(key))) {
        const field = key.split(/[.[]/)[0];
        byField.set(field, [...(byField.get(field) ?? []), key]);
      }
    return [...byField].map(([field, keys]) =>
      keys.length === 1
        ? {
            name: keys[0].replace(/\[\d+\]/g, ""),
            values: {
              before: value(before, old.get(keys[0])),
              after: value(after, now.get(keys[0])),
            },
          }
        : { name: field },
    );
  };

  const changes: SceneChange[] = [];
  for (const [id, object] of after.objects) {
    const old = before.objects.get(id);
    const path = pathOf(after, id);
    if (!old) {
      changes.push({
        kind: "added",
        path,
        parent: pathOf(after, object.parent),
        prefab: !!object.prefab,
      });
      continue;
    }
    if (nameOf(old) !== nameOf(object))
      changes.push({
        kind: "renamed",
        path,
        before: nameOf(old),
        after: nameOf(object),
      });
    if (old.parent !== object.parent)
      changes.push({
        kind: "reparented",
        path,
        before: pathOf(before, old.parent),
        after: pathOf(after, object.parent),
      });
    if (old.active !== object.active)
      changes.push({ kind: "active", path, after: object.active });
    const moved = new Set<string>();
    for (const kind of ["position", "rotation", "scale"] as const) {
      const a = old[kind],
        b = object[kind];
      if (!a || !b) continue;
      moved.add(kind);
      if (a.some((v, i) => Math.abs(v - b[i]) > 1e-4))
        changes.push({ kind, path, before: a, after: b });
    }
    const fields = changedFields(old.data, object.data);
    if (fields.length) changes.push({ kind: "fields", path, fields });

    const oldComponents = new Map(old.components.map((c) => [c.fileId, c]));
    for (const component of object.components) {
      const previous = oldComponents.get(component.fileId);
      oldComponents.delete(component.fileId);
      if (!previous) {
        changes.push({
          kind: "component-added",
          path,
          component: componentName(component),
        });
        continue;
      }
      const fields = changedFields(previous.data, component.data);
      if (fields.length)
        changes.push({
          kind: "fields",
          path,
          component: componentName(component),
          fields,
        });
    }
    for (const removed of oldComponents.values())
      changes.push({
        kind: "component-removed",
        path,
        component: componentName(removed),
      });

    if (old.prefab && object.prefab)
      for (const o of overrides(old, object, moved))
        changes.push({
          kind: "override",
          path,
          property: o.property,
          before: value(before, o.before),
          after: value(after, o.after),
        });
  }
  for (const [id, object] of before.objects)
    if (!after.objects.has(id))
      changes.push({
        kind: "removed",
        path: pathOf(before, id),
        parent: pathOf(before, object.parent),
        prefab: !!object.prefab,
      });

  for (const [id, setting] of after.settings) {
    const old = before.settings.get(id);
    const fields = old ? changedFields(old.data, setting.data) : [];
    if (fields.length)
      changes.push({
        kind: "settings",
        path: setting.type.replace(/([a-z])([A-Z])/g, "$1 $2"),
        fields,
      });
  }
  return changes;
}

/** Changes made to one placed prefab, minus its name and the moves already shown as such. */
function overrides(old: SceneObject, object: SceneObject, moved: Set<string>) {
  const a = old.prefab!,
    b = object.prefab!;
  const root = b.root ?? a.root;
  // Unity writes rotations twice; the editor's degrees are the readable half.
  const hinted = new Set<string>();
  for (const key of [...a.modifications.keys(), ...b.modifications.keys()]) {
    const [target, property] = splitKey(key);
    if (property.startsWith("m_LocalEulerAnglesHint.")) hinted.add(target);
  }
  const shown = (key: string) => {
    const [target, property] = splitKey(key);
    if (key === a.nameKey || key === b.nameKey || property === "m_RootOrder")
      return false;
    if (property.startsWith("m_LocalRotation.") && hinted.has(target))
      return false;
    if (target !== root) return true;
    const kind = property.match(TRANSFORM_OVERRIDE)?.[1];
    return !(
      (kind === "Position" && moved.has("position")) ||
      ((kind === "Rotation" || kind === "EulerAnglesHint") &&
        moved.has("rotation")) ||
      (kind === "Scale" && moved.has("scale"))
    );
  };
  const result: { property: string; before?: Leaf; after?: Leaf }[] = [];
  for (const key of new Set([
    ...a.modifications.keys(),
    ...b.modifications.keys(),
  ])) {
    const before = a.modifications.get(key),
      after = b.modifications.get(key);
    if (leafKey(before) !== leafKey(after) && shown(key))
      result.push({ property: splitKey(key)[1], before, after });
  }
  return result;
}

export function diffScenes(
  before: string | null,
  after: string | null,
  assets?: Map<string, string>,
) {
  return diffSceneModels(parseScene(before), parseScene(after), assets);
}
