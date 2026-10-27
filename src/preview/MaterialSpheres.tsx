import { useEffect, useState } from "react";
import { ArrowRight } from "lucide-react";
import * as THREE from "three";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import { useI18n } from "../i18n/i18n";
import type { MaterialLook } from "../unity/material";

export type SphereLook = MaterialLook & { mapUrl?: string; normalUrl?: string };

const SIZE = 120;

const srgb = ({ r, g, b }: { r: number; g: number; b: number }) =>
  new THREE.Color().setRGB(r, g, b, THREE.SRGBColorSpace);

/** Draws each look once on a sphere and keeps the pictures; no live WebGL view is needed. */
async function draw(looks: (SphereLook | null)[]) {
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  const loader = new THREE.TextureLoader();
  const load = (url?: string) =>
    url ? loader.loadAsync(url).catch(() => null) : Promise.resolve(null);
  try {
    renderer.setPixelRatio(Math.min(2, window.devicePixelRatio));
    renderer.setSize(SIZE, SIZE, false);
    const pmrem = new THREE.PMREMGenerator(renderer);
    const environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    const geometry = new THREE.SphereGeometry(1, 64, 32);
    const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 10);
    camera.position.set(0, 0, 4.1);
    const pictures: (string | null)[] = [];
    for (const look of looks) {
      if (!look) {
        pictures.push(null);
        continue;
      }
      const [map, normalMap] = await Promise.all([
        load(look.mapUrl),
        load(look.normalUrl),
      ]);
      if (map) map.colorSpace = THREE.SRGBColorSpace;
      const material = look.unlit
        ? new THREE.MeshBasicMaterial({ color: srgb(look.color), map })
        : new THREE.MeshStandardMaterial({
            color: srgb(look.color),
            map,
            normalMap,
            metalness: look.metallic,
            roughness: 1 - look.smoothness,
            emissive: look.emission ? srgb(look.emission) : 0x000000,
          });
      const scene = new THREE.Scene();
      scene.environment = environment;
      const sun = new THREE.DirectionalLight(0xffffff, 1.6);
      sun.position.set(2, 3, 4);
      scene.add(sun, new THREE.Mesh(geometry, material));
      renderer.render(scene, camera);
      pictures.push(renderer.domElement.toDataURL());
      material.dispose();
      map?.dispose();
      normalMap?.dispose();
    }
    geometry.dispose();
    environment.dispose();
    pmrem.dispose();
    return pictures;
  } finally {
    renderer.dispose();
    renderer.forceContextLoss();
  }
}

/** The material on a sphere, before and after: an approximation of Unity's look. */
export default function MaterialSpheres({
  before,
  after,
}: {
  before: SphereLook | null;
  after: SphereLook | null;
}) {
  const { t } = useI18n();
  const [pictures, setPictures] = useState<(string | null)[]>([]);
  const key = JSON.stringify([before, after]);
  useEffect(() => {
    let current = true;
    draw([before, after])
      .then((drawn) => current && setPictures(drawn))
      .catch(() => current && setPictures([]));
    return () => {
      current = false;
    };
    // The looks are plain data; their JSON says when they change.
  }, [key]);
  const [a, b] = pictures;
  return (
    <figure className="material-spheres" title={t("material.approximate")}>
      {a && <img src={a} alt={t("preview.before")} />}
      {a && b && <ArrowRight className="change-arrow" />}
      {b && <img src={b} alt={t("preview.after")} />}
      {(a || b) && <figcaption>{t("material.approximate")}</figcaption>}
    </figure>
  );
}
