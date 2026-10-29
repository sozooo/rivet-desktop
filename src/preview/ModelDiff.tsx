import { useEffect, useRef, useState } from "react";
import { Pause, Play } from "lucide-react";
import * as THREE from "three";
import { FBXLoader } from "three/examples/jsm/loaders/FBXLoader.js";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { OBJLoader } from "three/examples/jsm/loaders/OBJLoader.js";
import { TGALoader } from "three/examples/jsm/loaders/TGALoader.js";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { extension } from "../git/paths";
import { useI18n } from "../i18n/i18n";
import { useDark, useSideLabel, type Pair } from "./data";

type Stats = {
  vertices: number;
  triangles: number;
  meshes: number;
  materials: number;
  bones: number;
};

type Loaded = {
  root: THREE.Object3D;
  clips: THREE.AnimationClip[];
  stats: Stats;
  /** Some textures could not be found, so their materials are plain grey. */
  untextured: boolean;
  /** Bones without a mesh, drawn as sticks so the animation can be seen. */
  skeleton: boolean;
};

const buffer = (bytes: Uint8Array) =>
  bytes.buffer.slice(
    bytes.byteOffset,
    bytes.byteOffset + bytes.byteLength,
  ) as ArrayBuffer;

// A 1×1 picture stands in for textures that live next to the model on someone's disk.
const NO_TEXTURE =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=";

async function load(path: string, bytes: Uint8Array): Promise<Loaded> {
  // Only textures embedded in the file are drawn; nothing is fetched from anywhere.
  const manager = new THREE.LoadingManager();
  manager.setURLModifier((url) =>
    /^(blob|data):/.test(url) ? url : NO_TEXTURE,
  );
  manager.addHandler(/\.tga$/i, new TGALoader(manager));
  let loading = false;
  const loaded = new Promise<void>((resolve) => {
    manager.onStart = () => (loading = true);
    manager.onLoad = resolve;
  });

  const ext = extension(path);
  let root: THREE.Object3D, clips: THREE.AnimationClip[];
  if (ext === "fbx") {
    root = new FBXLoader(manager).parse(buffer(bytes), "");
    clips = root.animations;
  } else if (ext === "obj") {
    root = new OBJLoader(manager).parse(new TextDecoder().decode(bytes));
    clips = [];
  } else {
    const gltf = await new GLTFLoader(manager).parseAsync(buffer(bytes), "");
    root = gltf.scene;
    clips = gltf.animations;
  }
  if (loading)
    await Promise.race([loaded, new Promise((r) => setTimeout(r, 4000))]);

  const stats = measure(root);
  const untextured = greyForMissingTextures(root);
  const skeleton = stats.meshes === 0 && stats.bones > 0;
  if (skeleton) addBoneSticks(root);
  return { root, clips, stats, untextured, skeleton };
}

function measure(root: THREE.Object3D): Stats {
  const stats: Stats = {
    vertices: 0,
    triangles: 0,
    meshes: 0,
    materials: 0,
    bones: 0,
  };
  const materials = new Set<THREE.Material>();
  const bones = new Set<THREE.Bone>();
  root.traverse((object) => {
    if (object instanceof THREE.Mesh) {
      const geometry = object.geometry as THREE.BufferGeometry;
      const count = geometry.attributes.position?.count ?? 0;
      stats.meshes++;
      stats.vertices += count;
      stats.triangles += (geometry.index?.count ?? count) / 3;
      [object.material].flat().forEach((m) => materials.add(m));
    }
    if (object instanceof THREE.Bone) bones.add(object);
    if (object instanceof THREE.SkinnedMesh)
      object.skeleton.bones.forEach((b) => bones.add(b));
  });
  stats.materials = materials.size;
  stats.bones = bones.size;
  return stats;
}

/** Replaces materials whose textures didn't load with neutral grey; true if any did. */
function greyForMissingTextures(root: THREE.Object3D) {
  let replaced = false;
  const grey = new THREE.MeshStandardMaterial({
    color: 0x9aa39a,
    roughness: 0.8,
  });
  const fix = (material: THREE.Material) => {
    const map = (material as THREE.MeshStandardMaterial).map;
    const image = map?.image as { width?: number } | undefined;
    if (!map || (image?.width ?? 0) > 1) return material;
    replaced = true;
    return grey;
  };
  root.traverse((object) => {
    if (!(object instanceof THREE.Mesh)) return;
    const geometry = object.geometry as THREE.BufferGeometry;
    if (!geometry.attributes.normal) geometry.computeVertexNormals();
    object.material = Array.isArray(object.material)
      ? object.material.map(fix)
      : fix(object.material);
  });
  return replaced;
}

/** Animation files often carry only a skeleton; sticks between the joints make it visible. */
function addBoneSticks(root: THREE.Object3D) {
  root.updateMatrixWorld(true);
  const bones: THREE.Bone[] = [];
  root.traverse((o) => o instanceof THREE.Bone && bones.push(o));
  const box = new THREE.Box3();
  for (const bone of bones)
    box.expandByPoint(bone.getWorldPosition(new THREE.Vector3()));
  const radius = Math.max(box.getSize(new THREE.Vector3()).length(), 1e-3) / 90;
  const material = new THREE.MeshStandardMaterial({
    color: 0xd9913d,
    roughness: 0.55,
  });
  const up = new THREE.Vector3(0, 1, 0);
  for (const bone of bones) {
    // Sticks hang off the bone, so they follow it; undo its scale to keep them thin.
    const scale = bone.getWorldScale(new THREE.Vector3()).x || 1;
    const r = radius / scale;
    bone.add(
      new THREE.Mesh(new THREE.SphereGeometry(r * 1.6, 12, 8), material),
    );
    for (const child of bone.children) {
      if (!(child instanceof THREE.Bone)) continue;
      const length = child.position.length();
      if (length < 1e-6) continue;
      const stick = new THREE.Mesh(
        new THREE.CylinderGeometry(r * 0.6, r, length, 8),
        material,
      );
      stick.position.copy(child.position).multiplyScalar(0.5);
      stick.quaternion.setFromUnitVectors(
        up,
        child.position.clone().normalize(),
      );
      bone.add(stick);
    }
  }
}

type View = {
  renderer: THREE.WebGLRenderer;
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  controls: OrbitControls;
  mixer?: THREE.AnimationMixer;
  clips: THREE.AnimationClip[];
  dirty: boolean;
};

/** One framing for both versions, so a model that grew also looks bigger. */
function frameFor(models: Loaded[]) {
  const box = new THREE.Box3();
  for (const { root } of models)
    box.union(new THREE.Box3().setFromObject(root));
  if (box.isEmpty())
    box.setFromCenterAndSize(new THREE.Vector3(), new THREE.Vector3(1, 1, 1));
  const size = box.getSize(new THREE.Vector3()).length() || 1;
  // Far enough for everything to fit; animations get room to move.
  const moving = models.some((m) => m.clips.length);
  const distance =
    (size / 2 / Math.sin(THREE.MathUtils.degToRad(FOV / 2))) *
    (moving ? 1.35 : 1.1);
  return {
    size,
    distance,
    floor: box.min.y,
    center: box.getCenter(new THREE.Vector3()),
  };
}

type Frame = ReturnType<typeof frameFor>;
const FOV = 40;

function createView(
  canvas: HTMLCanvasElement,
  loaded: Loaded,
  { size, distance, floor, center }: Frame,
  dark: boolean,
): View {
  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: true,
    alpha: true,
  });
  renderer.setPixelRatio(window.devicePixelRatio);
  const scene = new THREE.Scene();
  scene.add(
    new THREE.HemisphereLight(0xffffff, dark ? 0x30302c : 0x8d8a7d, 2.2),
  );
  const sun = new THREE.DirectionalLight(0xffffff, 2.4);
  sun.position.set(3, 5, 4);
  scene.add(sun);
  scene.add(loaded.root);
  const grid = new THREE.GridHelper(
    size * 2,
    10,
    dark ? 0x56615a : 0xc5c8bf,
    dark ? 0x343c37 : 0xe4e5df,
  );
  grid.position.y = floor;
  scene.add(grid);
  const camera = new THREE.PerspectiveCamera(FOV, 1, size / 100, size * 100);
  camera.position
    .copy(center)
    .addScaledVector(new THREE.Vector3(0.9, 0.6, 1.1).normalize(), distance);
  const controls = new OrbitControls(camera, canvas);
  controls.target.copy(center);
  controls.enableDamping = true;
  controls.update();
  const mixer = loaded.clips.length
    ? new THREE.AnimationMixer(loaded.root)
    : undefined;
  return {
    renderer,
    scene,
    camera,
    controls,
    mixer,
    clips: loaded.clips,
    dirty: true,
  };
}

export default function ModelDiff({
  path,
  pair,
}: {
  path: string;
  pair: Pair;
}) {
  const { t } = useI18n();
  const label = useSideLabel();
  const dark = useDark();
  const [models, setModels] = useState<{
    before?: Loaded | null;
    after?: Loaded | null;
    error?: string;
  }>();
  const [playing, setPlaying] = useState<string | null>(null);
  const stages = {
    before: useRef<HTMLDivElement>(null),
    after: useRef<HTMLDivElement>(null),
  };
  const views = useRef<{ before?: View; after?: View }>({});

  useEffect(() => {
    let current = true;
    setModels(undefined);
    setPlaying(null);
    Promise.all([
      pair.before ? load(path, pair.before) : null,
      pair.after ? load(path, pair.after) : null,
    ])
      .then(([before, after]) => current && setModels({ before, after }))
      .catch(
        (error: Error) =>
          current && setModels({ error: String(error?.message ?? error) }),
      );
    return () => {
      current = false;
    };
  }, [path, pair]);

  useEffect(() => {
    if (!models || models.error) return;
    const created: View[] = [];
    const framing = frameFor(
      [models.before, models.after].filter((m): m is Loaded => !!m),
    );
    for (const side of ["before", "after"] as const) {
      const stage = stages[side].current;
      const loaded = models[side];
      if (!stage || !loaded) continue;
      // A fresh canvas each time: a canvas whose context was released can't get a new one.
      const canvas = document.createElement("canvas");
      stage.append(canvas);
      const view = createView(canvas, loaded, framing, dark);
      views.current[side] = view;
      created.push(view);
    }
    // Turning one model turns the other, so both are seen from the same angle.
    const [a, b] = created;
    if (a && b) {
      let syncing = false;
      const link = (from: View, to: View) =>
        from.controls.addEventListener("change", () => {
          if (syncing) return;
          syncing = true;
          to.camera.position.copy(from.camera.position);
          to.controls.target.copy(from.controls.target);
          to.controls.update();
          to.dirty = true;
          syncing = false;
        });
      link(a, b);
      link(b, a);
    }
    const clock = new THREE.Clock();
    let frame = 0;
    // Draws only when something moved, so an open preview doesn't keep the GPU busy.
    const render = () => {
      const delta = clock.getDelta();
      for (const view of created) {
        const canvas = view.renderer.domElement;
        const { clientWidth: w, clientHeight: h } = canvas;
        if (
          canvas.width !== Math.floor(w * window.devicePixelRatio) ||
          canvas.height !== Math.floor(h * window.devicePixelRatio)
        ) {
          view.renderer.setSize(w, h, false);
          view.camera.aspect = w / Math.max(h, 1);
          view.camera.updateProjectionMatrix();
          view.dirty = true;
        }
        const mixer = view.mixer;
        if (
          mixer &&
          view.clips.some((c) => mixer.existingAction(c)?.isRunning())
        ) {
          mixer.update(delta);
          view.dirty = true;
        }
        if (view.controls.update()) view.dirty = true;
        if (view.dirty) view.renderer.render(view.scene, view.camera);
        view.dirty = false;
      }
      frame = requestAnimationFrame(render);
    };
    render();
    return () => {
      cancelAnimationFrame(frame);
      for (const view of created) {
        view.controls.dispose();
        view.renderer.dispose();
        view.renderer.forceContextLoss();
        view.renderer.domElement.remove();
      }
      views.current = {};
    };
  }, [models, dark]);

  useEffect(() => {
    for (const view of Object.values(views.current)) {
      if (!view?.mixer) continue;
      view.mixer.stopAllAction();
      const clip = view.clips.find((c) => c.name === playing);
      if (clip) view.mixer.clipAction(clip).play();
      view.dirty = true;
    }
  }, [playing, models, dark]);

  const clips = (() => {
    const all = new Map<string, { before?: number; after?: number }>();
    for (const side of ["before", "after"] as const)
      for (const clip of models?.[side]?.clips ?? [])
        all.set(clip.name, { ...all.get(clip.name), [side]: clip.duration });
    return [...all];
  })();

  if (models?.error)
    return (
      <div className="preview card-preview">
        <p className="muted">
          {/version|not supported/i.test(models.error)
            ? t("model.oldFbx")
            : t("model.failed", { error: models.error })}
        </p>
      </div>
    );

  const seconds = (value?: number) =>
    value === undefined
      ? "—"
      : t("model.seconds", { value: Math.round(value * 100) / 100 });
  const rows = [
    ["model.vertices", "vertices"],
    ["model.triangles", "triangles"],
    ["model.meshes", "meshes"],
    ["model.materials", "materials"],
    ["model.bones", "bones"],
  ] as const;
  const either = (key: "untextured" | "skeleton") =>
    !!models?.before?.[key] || !!models?.after?.[key];

  return (
    <div className="preview model-diff">
      <div className="model-pair">
        {(["before", "after"] as const).map((side) =>
          pair[side] ? (
            <figure className="model-panel" key={side}>
              <figcaption>
                <strong>{label(side, !!pair.before && !!pair.after)}</strong>
                <span className="muted">{t("model.drag")}</span>
              </figcaption>
              <div className="model-stage" ref={stages[side]}>
                {!models && (
                  <span className="muted">{t("preview.loading")}</span>
                )}
              </div>
            </figure>
          ) : null,
        )}
      </div>
      {(either("untextured") || either("skeleton")) && (
        <p className="preview-note-line model-note">
          {t(either("skeleton") ? "model.skeleton" : "model.textures")}
        </p>
      )}
      <div className="model-info">
        <table className="model-stats">
          <tbody>
            {rows.map(([label, key]) => {
              const a = models?.before?.stats[key];
              const b = models?.after?.stats[key];
              return (
                <tr
                  key={key}
                  className={
                    a !== undefined && b !== undefined && a !== b
                      ? "changed"
                      : ""
                  }
                >
                  <th>{t(label)}</th>
                  <td>{a ?? "—"}</td>
                  <td>→</td>
                  <td>{b ?? "—"}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
        <div className="model-clips">
          <strong>{t("model.animations")}</strong>
          {!clips.length && (
            <span className="muted">{t("model.noAnimations")}</span>
          )}
          {clips.map(([name, durations]) => (
            <button
              key={name}
              className={`clip ${playing === name ? "active" : ""}`}
              title={t("model.play", { name })}
              onClick={() => setPlaying(playing === name ? null : name)}
            >
              {playing === name ? <Pause /> : <Play />}
              <span>{name}</span>
              <small>
                {seconds(durations.before)} → {seconds(durations.after)}
              </small>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
