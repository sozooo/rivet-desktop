import {
  ProgressTracker,
  type ProgressCommand,
  type ProgressListener,
} from "../progress";

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/** git counting through one phase, or git-lfs moving files. */
type Step =
  | {
      git: string;
      total: number;
      remote?: boolean;
      /** How much arrives or leaves, for "Receiving objects" and "Writing objects". */
      megabytes?: number;
      ms: number;
    }
  | {
      lfs: "download" | "upload";
      files: { name: string; size: number }[];
      ms: number;
    };

const MB = 1024 * 1024;
const TICK = 80;

/**
 * Writes the lines git and git-lfs would, through a real ProgressTracker, so
 * the demo shows progress just like the desktop app.
 */
async function simulate(
  command: ProgressCommand,
  steps: Step[],
  onProgress: ProgressListener,
  expected?: { files: number; bytes: number },
) {
  const tracker = new ProgressTracker(command, expected);
  const feed = (source: "git" | "lfs", line: string) => {
    const progress = tracker.line(source, line);
    if (progress) onProgress(progress);
  };
  for (const step of steps) {
    const ticks = Math.max(1, Math.round(step.ms / TICK));
    for (let tick = 1; tick <= ticks; tick++) {
      const share = tick / ticks;
      if ("git" in step) {
        const count = Math.round(step.total * share);
        const percent = String(Math.floor(share * 100)).padStart(3);
        const size = step.megabytes
          ? `, ${(step.megabytes * share).toFixed(2)} MiB | 4.20 MiB/s`
          : "";
        feed(
          "git",
          `${step.remote ? "remote: " : ""}${step.git}: ${percent}% (${count}/${step.total})${size}${tick === ticks ? ", done." : ""}`,
        );
      } else {
        // One file after another, each line carrying that file's bytes so far.
        let moved = sizeOf(step.files) * share;
        step.files.forEach((file, index) => {
          const read = Math.round(Math.min(file.size, moved));
          moved -= file.size;
          if (read > 0)
            feed(
              "lfs",
              `${step.lfs} ${index + 1}/${step.files.length} ${read}/${file.size} ${file.name}`,
            );
        });
      }
      await wait(TICK);
    }
  }
}

const sizeOf = (files: { size: number }[]) =>
  files.reduce((total, f) => total + f.size, 0);
const expect = (files: { size: number }[]) => ({
  files: files.length,
  bytes: sizeOf(files),
});

const ART = [
  { name: "Assets/Art/Forest/Cliff_Albedo.psd", size: 84 * MB },
  { name: "Assets/Art/Forest/Cliff_Normal.png", size: 22 * MB },
  { name: "Assets/Art/Characters/Hero/Hero.fbx", size: 37 * MB },
  { name: "Assets/Art/Characters/Hero/Hero_Run.anim", size: 6 * MB },
  { name: "Assets/Audio/Forest_Ambience.wav", size: 58 * MB },
];
const INCOMING_ART = ART.slice(1, 3);
const OUTGOING_ART = [ART[0], ART[3]];

/** What the demo shows for each long operation, in a few seconds. */
export const demoTransfers = {
  clone: (onProgress: ProgressListener) =>
    simulate(
      "clone",
      [
        { git: "Counting objects", total: 4210, remote: true, ms: 300 },
        { git: "Compressing objects", total: 2918, remote: true, ms: 300 },
        { git: "Receiving objects", total: 4210, megabytes: 18.4, ms: 2400 },
        { git: "Resolving deltas", total: 1730, ms: 600 },
        { git: "Updating files", total: 3112, ms: 500 },
        { lfs: "download", files: ART, ms: 3800 },
      ],
      onProgress,
      expect(ART),
    ),
  fetch: (onProgress: ProgressListener) =>
    simulate(
      "fetch",
      [
        { git: "Counting objects", total: 48, remote: true, ms: 200 },
        { git: "Compressing objects", total: 31, remote: true, ms: 200 },
        { git: "Receiving objects", total: 48, megabytes: 2.6, ms: 900 },
        { git: "Resolving deltas", total: 17, ms: 300 },
      ],
      onProgress,
    ),
  pull: (onProgress: ProgressListener) =>
    simulate(
      "pull",
      [
        { git: "Updating files", total: 26, ms: 500 },
        { lfs: "download", files: INCOMING_ART, ms: 2200 },
      ],
      onProgress,
    ),
  push: (onProgress: ProgressListener) =>
    simulate(
      "push",
      [
        { lfs: "upload", files: OUTGOING_ART, ms: 2600 },
        { git: "Counting objects", total: 21, ms: 200 },
        { git: "Compressing objects", total: 12, ms: 200 },
        { git: "Writing objects", total: 14, megabytes: 0.4, ms: 900 },
      ],
      onProgress,
    ),
  lfsPull: (onProgress: ProgressListener) =>
    simulate(
      "lfs",
      [{ lfs: "download", files: INCOMING_ART, ms: 2600 }],
      onProgress,
      expect(INCOMING_ART),
    ),
};
