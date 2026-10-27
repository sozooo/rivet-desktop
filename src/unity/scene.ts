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

type Vector = [number, number, number];

export type SceneObject = {
  fileId: string;
  name: string;
  active: boolean;
  parent: string | null;
  position?: Vector;
  rotation?: Vector;
  scale?: Vector;
  components: { fileId: string; type: string; data: YamlMap }[];
};

export type PrefabInstance = {
  fileId: string;
  name: string;
  source: string;
  parent: string | null;
  modifications: Map<string, string>;
};

export type SceneModel = {
  objects: Map<string, SceneObject>;
  prefabs: Map<string, PrefabInstance>;
};

/** One readable change, keyed by the object path it belongs to. */
export type SceneChange =
  | { kind: "added" | "removed"; path: string; parent: string }
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
      kind: "component-changed";
      path: string;
      component: string;
      fields: string[];
    }
  | { kind: "prefab-added" | "prefab-removed"; path: string }
  | {
      kind: "override";
      path: string;
      property: string;
      before: string | null;
      after: string | null;
    };

const TRANSFORM_TYPES = new Set(["Transform", "RectTransform"]);
const IGNORED_FIELDS = new Set([
  "m_ObjectHideFlags",
  "m_CorrespondingSourceObject",
  "m_PrefabInstance",
  "m_PrefabAsset",
  "m_GameObject",
  "serializedVersion",
]);

const vector = (value: YamlValue | undefined): Vector | undefined =>
  isMap(value)
    ? [
        Number(asText(value.x)),
        Number(asText(value.y)),
        Number(asText(value.z)),
      ]
    : undefined;

/** Unity stores rotations as quaternions; people think in degrees. */
function euler(value: YamlValue | undefined): Vector | undefined {
  if (!isMap(value)) return undefined;
  const [x, y, z, w] = ["x", "y", "z", "w"].map((k) =>
    Number(asText(value[k])),
  );
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

export function buildScene(documents: UnityDocument[]): SceneModel {
  const objects = new Map<string, SceneObject>();
  const transformOwner = new Map<string, string>();
  const prefabs = new Map<string, PrefabInstance>();

  for (const doc of documents) {
    if (doc.classId !== 1 || doc.stripped) continue;
    objects.set(doc.fileId, {
      fileId: doc.fileId,
      name: asText(doc.data.m_Name) || "GameObject",
      active: asText(doc.data.m_IsActive) !== "0",
      parent: null,
      components: [],
    });
  }
  for (const doc of documents) {
    const owner = reference(doc.data.m_GameObject)?.fileId;
    const object = owner ? objects.get(owner) : undefined;
    if (!object || doc.stripped) continue;
    if (TRANSFORM_TYPES.has(doc.type)) {
      transformOwner.set(doc.fileId, object.fileId);
      object.position = vector(doc.data.m_LocalPosition);
      object.rotation = euler(doc.data.m_LocalRotation);
      object.scale = vector(doc.data.m_LocalScale);
    } else {
      object.components.push({
        fileId: doc.fileId,
        type: componentType(doc),
        data: doc.data,
      });
    }
  }
  // Parents are known once every transform has an owner.
  for (const doc of documents) {
    if (!TRANSFORM_TYPES.has(doc.type)) continue;
    const owner = transformOwner.get(doc.fileId);
    const father = reference(doc.data.m_Father)?.fileId;
    if (owner && father)
      objects.get(owner)!.parent = transformOwner.get(father) ?? null;
  }

  for (const doc of documents) {
    if (doc.type !== "PrefabInstance") continue;
    const modification = isMap(doc.data.m_Modification)
      ? doc.data.m_Modification
      : {};
    const modifications = new Map<string, string>();
    let name = "";
    for (const item of asList(modification.m_Modifications)) {
      if (!isMap(item)) continue;
      const property = asText(item.propertyPath);
      const target = reference(item.target)?.fileId ?? "";
      const objectRef = reference(item.objectReference);
      const value = objectRef
        ? `ref:${objectRef.guid || objectRef.fileId}`
        : asText(item.value);
      if (property === "m_Name") name = value;
      modifications.set(`${target}:${property}`, value);
    }
    const parentTransform = reference(modification.m_TransformParent)?.fileId;
    prefabs.set(doc.fileId, {
      fileId: doc.fileId,
      name: name || "Prefab",
      source: reference(doc.data.m_SourcePrefab)?.guid ?? "",
      parent: parentTransform
        ? (transformOwner.get(parentTransform) ?? null)
        : null,
      modifications,
    });
  }
  return { objects, prefabs };
}

function componentType(doc: UnityDocument) {
  if (doc.type !== "MonoBehaviour") return doc.type;
  // Scripts are known by their asset; the editor class name is the best we have.
  return asText(doc.data.m_EditorClassIdentifier).split("::").pop() || "Script";
}

function pathOf(model: SceneModel, id: string | null): string {
  const names: string[] = [];
  const seen = new Set<string>();
  while (id && !seen.has(id)) {
    seen.add(id);
    const object = model.objects.get(id);
    if (!object) break;
    names.unshift(object.name);
    id = object.parent;
  }
  return names.join("/");
}

const same = (a?: Vector, b?: Vector) =>
  !a || !b || a.every((v, i) => Math.abs(v - b[i]) < 1e-4);

function flatten(value: YamlValue, prefix: string, out: Map<string, string>) {
  if (typeof value === "string") out.set(prefix, value);
  else if (Array.isArray(value))
    value.forEach((v, i) => flatten(v, `${prefix}[${i}]`, out));
  else
    for (const [k, v] of Object.entries(value)) {
      if (!prefix && IGNORED_FIELDS.has(k)) continue;
      flatten(v, prefix ? `${prefix}.${k}` : k, out);
    }
}

/** Top-level field names that differ between two component versions. */
function changedFields(before: YamlMap, after: YamlMap) {
  const a = new Map<string, string>(),
    b = new Map<string, string>();
  flatten(before, "", a);
  flatten(after, "", b);
  const fields = new Set<string>();
  for (const key of new Set([...a.keys(), ...b.keys()]))
    if (a.get(key) !== b.get(key)) fields.add(key.split(/[.[]/)[0]);
  return [...fields];
}

export function diffScenes(
  beforeText: string | null,
  afterText: string | null,
): SceneChange[] {
  const before = buildScene(beforeText ? parseUnityYaml(beforeText) : []);
  const after = buildScene(afterText ? parseUnityYaml(afterText) : []);
  const changes: SceneChange[] = [];

  for (const [id, object] of after.objects) {
    const old = before.objects.get(id);
    const path = pathOf(after, id);
    if (!old) {
      changes.push({
        kind: "added",
        path,
        parent: pathOf(after, object.parent),
      });
      continue;
    }
    if (old.name !== object.name)
      changes.push({
        kind: "renamed",
        path,
        before: old.name,
        after: object.name,
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
    for (const kind of ["position", "rotation", "scale"] as const)
      if (!same(old[kind], object[kind]))
        changes.push({ kind, path, before: old[kind]!, after: object[kind]! });

    const oldComponents = new Map(old.components.map((c) => [c.fileId, c]));
    for (const component of object.components) {
      const previous = oldComponents.get(component.fileId);
      if (!previous)
        changes.push({
          kind: "component-added",
          path,
          component: component.type,
        });
      else {
        const fields = changedFields(previous.data, component.data);
        if (fields.length)
          changes.push({
            kind: "component-changed",
            path,
            component: component.type,
            fields,
          });
      }
      oldComponents.delete(component.fileId);
    }
    for (const removed of oldComponents.values())
      changes.push({
        kind: "component-removed",
        path,
        component: removed.type,
      });
  }
  for (const [id, object] of before.objects)
    if (!after.objects.has(id))
      changes.push({
        kind: "removed",
        path: pathOf(before, id),
        parent: pathOf(before, object.parent),
      });

  for (const [id, prefab] of after.prefabs) {
    const old = before.prefabs.get(id);
    const parent = pathOf(after, prefab.parent);
    const path = parent ? `${parent}/${prefab.name}` : prefab.name;
    if (!old) {
      changes.push({ kind: "prefab-added", path });
      continue;
    }
    for (const key of new Set([
      ...old.modifications.keys(),
      ...prefab.modifications.keys(),
    ])) {
      const a = old.modifications.get(key) ?? null;
      const b = prefab.modifications.get(key) ?? null;
      if (a !== b)
        changes.push({
          kind: "override",
          path,
          property: key.slice(key.indexOf(":") + 1),
          before: a,
          after: b,
        });
    }
  }
  for (const [id, prefab] of before.prefabs)
    if (!after.prefabs.has(id)) {
      const parent = pathOf(before, prefab.parent);
      changes.push({
        kind: "prefab-removed",
        path: parent ? `${parent}/${prefab.name}` : prefab.name,
      });
    }
  return changes;
}
