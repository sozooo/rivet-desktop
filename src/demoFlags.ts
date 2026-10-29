/**
 * Switches for the browser demo, read from the address, to see screens that real
 * computers rarely show: `?git=missing|old`, `?lfs=missing`, `?identity=empty`,
 * `?fail=<sample>` (one of src/errors/samples.ts) and `?crash`. The desktop app ignores them.
 */
const params = new URLSearchParams(
  typeof location === "undefined" ? "" : location.search,
);

export const demoFlags = {
  git: params.get("git") as "missing" | "old" | null,
  lfs: params.get("lfs") as "missing" | null,
  identity: params.get("identity") as "empty" | null,
  fail: params.get("fail"),
  crash: params.has("crash"),
};
