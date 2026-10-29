// Publishes a new version of Rivet:
//   npm run release -- 0.2.0 "What's new: …"
// Sets the version everywhere, commits, tags v0.2.0 with the notes and pushes.
// GitHub Actions then builds the installer and publishes the release that
// installed copies of Rivet update from. The notes appear in the update dialog.
import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";

const fail = (message) => {
  console.error(message);
  process.exit(1);
};
const git = (...args) => execFileSync("git", args, { encoding: "utf8" }).trim();
const parse = (v) => v.split(".").map(Number);
const compare = (a, b) => {
  for (const [x, y] of parse(a).map((n, i) => [n, parse(b)[i]]))
    if (x !== y) return x - y;
  return 0;
};

const [version, ...noteWords] = process.argv.slice(2);
const notes = noteWords.join(" ").trim();
if (!/^\d+\.\d+\.\d+$/.test(version ?? ""))
  fail(`Usage: npm run release -- 0.2.0 "What's new"`);
// Releases and their notes are in English.
if (/\p{Script=Cyrillic}/u.test(notes))
  fail("Write the release notes in English.");

const current = JSON.parse(readFileSync("package.json", "utf8")).version;
if (compare(version, current) < 0)
  fail(`${version} is older than the current ${current}.`);
if (git("status", "--porcelain")) fail("Commit or stash your changes first.");
if (git("branch", "--show-current") !== "main") fail("Release from main.");
if (git("tag", "--list", `v${version}`)) fail(`v${version} already exists.`);
if (!git("remote")) fail("Add the GitHub repository as origin first.");

if (version !== current) {
  const edit = (path, change) =>
    writeFileSync(path, change(readFileSync(path, "utf8")));
  const json = (path, change) =>
    edit(
      path,
      (text) => JSON.stringify(change(JSON.parse(text)), null, 2) + "\n",
    );
  json("package.json", (p) => ({ ...p, version }));
  json("package-lock.json", (p) => {
    p.version = version;
    p.packages[""].version = version;
    return p;
  });
  json("src-tauri/tauri.conf.json", (c) => ({ ...c, version }));
  edit("src-tauri/Cargo.toml", (text) =>
    text.replace(/^version = ".*"$/m, `version = "${version}"`),
  );
  edit("src-tauri/Cargo.lock", (text) =>
    text.replace(
      /(\[\[package\]\]\nname = "rivet"\nversion = )".*"/,
      `$1"${version}"`,
    ),
  );
  git(
    "add",
    "package.json",
    "package-lock.json",
    "src-tauri/tauri.conf.json",
    "src-tauri/Cargo.toml",
    "src-tauri/Cargo.lock",
  );
  git("commit", "-m", `Release ${version}`);
}
git("tag", "-a", `v${version}`, "-m", notes || `Rivet ${version}`);
git("push", "origin", "main");
git("push", "origin", `v${version}`);
console.log(
  `Released v${version}. GitHub Actions is building it now; installed copies will offer the update once the release is published.`,
);
