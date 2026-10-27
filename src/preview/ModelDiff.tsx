import { useEffect, useMemo, useRef, useState } from "react";
import { Pause, Play } from "lucide-react";
import * as THREE from "three";
import { FBXLoader } from "three/examples/jsm/loaders/FBXLoader.js";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { OBJLoader } from "three/examples/jsm/loaders/OBJLoader.js";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { extension } from "../git/paths";
import { useI18n } from "../i18n/i18n";
import type { Pair } from "./data";

type Loaded = { root: THREE.Object3D; clips: THREE.AnimationClip[] };
type Stats = {
  vertices: number;
  triangles: number;
  meshes: number;
  materials: number;
  bones: number;
};

const buffer = (bytes: Uint8Array) =>
  bytes.buffer.slice(
    bytes.byteOffset,
    bytes.byteOffset + bytes.byteLength,
  ) as ArrayBuffer;

async function load(path: string, bytes: Uint8Array): Promise<Loaded> {
  const ext = extension(path);
  if (ext === "fbx") {
    const root = new FBXLoader().parse(buffer(bytes), "");
    return { root, clips: root.animations };
  }
  if (ext === "obj")
    return {
      root: new OBJLoader().parse(new TextDecoder().decode(bytes)),
      clips: [],
    };
  const gltf = await new GLTFLoader().parseAsync(buffer(bytes), "");
  return { root: gltf.scene, clips: gltf.animations };
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
    if (object instanceof THREE.SkinnedMesh)
      object.skeleton.bones.forEach((b) => bones.add(b));
  });
  stats.materials = materials.size;
  stats.bones = bones.size;
  return stats;
}

/** Makes models without usable materials or normals look solid and readable. */
function prepare(root: THREE.Object3D) {
  root.traverse((object) => {
    if (!(object instanceof THREE.Mesh)) return;
    const geometry = object.geometry as THREE.BufferGeometry;
    if (!geometry.attributes.normal) geometry.computeVertexNormals();
    const fix = (m: THREE.Material) =>
      "map" in m && m.map && !(m.map as THREE.Texture).image
        ? new THREE.MeshStandardMaterial({ color: 0x9aa39a, roughness: 0.8 })
        : m;
    object.material = Array.isArray(object.material)
      ? object.material.map(fix)
      : fix(object.material);
  });
}

type View = {
  renderer: THREE.WebGLRenderer;
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  controls: OrbitControls;
  mixer?: THREE.AnimationMixer;
  clips: THREE.AnimationClip[];
};

function createView(
  canvas: HTMLCanvasElement,
  loaded: Loaded,
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
  prepare(loaded.root);
  scene.add(loaded.root);
  const box = new THREE.Box3().setFromObject(loaded.root);
  const size = box.getSize(new THREE.Vector3()).length() || 1;
  const center = box.getCenter(new THREE.Vector3());
  const grid = new THREE.GridHelper(
    size * 2,
    10,
    dark ? 0x56615a : 0xc5c8bf,
    dark ? 0x343c37 : 0xe4e5df,
  );
  grid.position.y = box.min.y;
  scene.add(grid);
  const camera = new THREE.PerspectiveCamera(40, 1, size / 100, size * 100);
  camera.position
    .copy(center)
    .add(new THREE.Vector3(size * 0.9, size * 0.6, size * 1.1));
  const controls = new OrbitControls(camera, canvas);
  controls.target.copy(center);
  controls.enableDamping = true;
  controls.update();
  const mixer = loaded.clips.length
    ? new THREE.AnimationMixer(loaded.root)
    : undefined;
  return { renderer, scene, camera, controls, mixer, clips: loaded.clips };
}

export default function ModelDiff({
  path,
  pair,
}: {
  path: string;
  pair: Pair;
}) {
  const { t } = useI18n();
  const [models, setModels] = useState<{
    before?: Loaded | null;
    after?: Loaded | null;
    error?: string;
  }>();
  const [playing, setPlaying] = useState<string | null>(null);
  const canvases = {
    before: useRef<HTMLCanvasElement>(null),
    after: useRef<HTMLCanvasElement>(null),
  };
  const views = useRef<{ before?: View; after?: View }>({});
  const dark = !!document.querySelector(".app.dark");

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
          current && setModels({ error: String(error.message ?? error) }),
      );
    return () => {
      current = false;
    };
  }, [path, pair]);

  useEffect(() => {
    if (!models || models.error) return;
    const created: View[] = [];
    for (const side of ["before", "after"] as const) {
      const canvas = canvases[side].current;
      const loaded = models[side];
      if (!canvas || !loaded) continue;
      const view = createView(canvas, loaded, dark);
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
          syncing = false;
        });
      link(a, b);
      link(b, a);
    }
    const clock = new THREE.Clock();
    let frame = 0;
    const render = () => {
      const delta = clock.getDelta();
      for (const view of created) {
        const canvas = view.renderer.domElement;
        const { clientWidth: w, clientHeight: h } = canvas;
        if (
          canvas.width !== w * window.devicePixelRatio ||
          canvas.height !== h * window.devicePixelRatio
        ) {
          view.renderer.setSize(w, h, false);
          view.camera.aspect = w / Math.max(h, 1);
          view.camera.updateProjectionMatrix();
        }
        view.mixer?.update(delta);
        view.controls.update();
        view.renderer.render(view.scene, view.camera);
      }
      frame = requestAnimationFrame(render);
    };
    render();
    return () => {
      cancelAnimationFrame(frame);
      for (const view of created) {
        view.controls.dispose();
        view.renderer.dispose();
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
    }
  }, [playing, models]);

  const stats = useMemo(
    () => ({
      before: models?.before ? measure(models.before.root) : null,
      after: models?.after ? measure(models.after.root) : null,
    }),
    [models],
  );
  const clips = useMemo(() => {
    const all = new Map<string, { before?: number; after?: number }>();
    for (const side of ["before", "after"] as const)
      for (const clip of models?.[side]?.clips ?? [])
        all.set(clip.name, { ...all.get(clip.name), [side]: clip.duration });
    return [...all];
  }, [models]);

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

  return (
    <div className="preview model-diff">
      <div className="model-pair">
        {(["before", "after"] as const).map((side) =>
          pair[side] ? (
            <figure className="model-panel" key={side}>
              <figcaption>
                <strong>
                  {pair.before && pair.after
                    ? t(side === "before" ? "preview.before" : "preview.after")
                    : t(side === "after" ? "preview.added" : "preview.deleted")}
                </strong>
                <span className="muted">{t("model.drag")}</span>
              </figcaption>
              <div className="model-stage">
                {!models && (
                  <span className="muted">{t("preview.loading")}</span>
                )}
                <canvas ref={canvases[side]} />
              </div>
            </figure>
          ) : null,
        )}
      </div>
      <div className="model-info">
        <table className="model-stats">
          <tbody>
            {rows.map(([label, key]) => {
              const a = stats.before?.[key];
              const b = stats.after?.[key];
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
