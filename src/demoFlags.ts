/**
 * Switches for the browser demo, read from the address, to see screens that real
 * computers rarely show: `?git=missing|old|offline`, `?lfs=missing`, `?identity=empty`,
 * `?fail=<sample>` (one of src/errors/samples.ts), `?crash`, `?gitignore=missing|committed`
 * for a Unity project whose generated folders aren't ignored, `?open=unity,blender` to
 * pretend Unity and Blender have files open, and `?files=<n>` to give the sample project n more
 * files for trying search at scale. The desktop app ignores them.
 */
const params = new URLSearchParams(
  typeof location === "undefined" ? "" : location.search,
);

export const demoFlags = {
  git: params.get("git") as "missing" | "old" | "offline" | null,
  lfs: params.get("lfs") as "missing" | null,
  identity: params.get("identity") as "empty" | null,
  fail: params.get("fail"),
  crash: params.has("crash"),
  gitignore: params.get("gitignore") as "missing" | "committed" | null,
  open: params.get("open"),
  files: Math.min(Number(params.get("files")) || 0, 200_000),
};
