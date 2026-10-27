export type Repository = {
  id: string;
  name: string;
  path: string;
  kind: "demo" | "create" | "open" | "clone";
  url?: string;
};

export type SetupMode = "clone" | "open" | "create";

/** One order everywhere: the repository menu and the setup tabs. */
export const setupModes: SetupMode[] = ["clone", "open", "create"];

const key = "rivet.repositories";

const defaults: Repository[] = [
  { id: "kinetic", name: "kinetic", path: "D:/Projects/kinetic", kind: "demo" },
  {
    id: "kinetic-sandbox",
    name: "kinetic-sandbox",
    path: "D:/Projects/kinetic-sandbox",
    kind: "demo",
  },
];

export function loadRepositories(): Repository[] {
  try {
    const stored = JSON.parse(localStorage.getItem(key) || "null");
    if (
      Array.isArray(stored) &&
      stored.length &&
      stored.every(
        (r) =>
          typeof r.id === "string" &&
          typeof r.name === "string" &&
          typeof r.path === "string" &&
          ["demo", "open", "clone", "create"].includes(r.kind),
      )
    )
      return stored;
  } catch {}
  return defaults;
}

export function saveRepositories(repositories: Repository[]) {
  try {
    localStorage.setItem(key, JSON.stringify(repositories));
  } catch {}
}

export const samePath = (a: string, b: string) =>
  a.replace(/\\/g, "/").replace(/\/+$/, "").toLowerCase() ===
  b.replace(/\\/g, "/").replace(/\/+$/, "").toLowerCase();
