import { Check, CheckCircle2, GitMerge } from "lucide-react";
import { DiffView } from "../../diff/DiffView";
import { conflictRevisions } from "../../git/conflicts";
import { fileKind } from "../../git/fileKinds";
import type { Conflict, Operation, Side } from "../../git/types";
import { groupFiles, primaryFile, type FileGroup } from "../../git/unity";
import { useI18n, type Key } from "../../i18n/i18n";
import { SideLabels } from "../../preview/data";
import type { RepoApi } from "../repoApi";

/** Whose versions a conflict is between: a pull, another operation, or restored changes. */
type Context = "merge" | "other" | "stash";

/** Names for the two sides, which depend on where the conflict came from. */
export function useSides(operation: Operation | null) {
  const { t } = useI18n();
  const context: Context = !operation
    ? "stash"
    : operation.kind === "merge"
      ? "merge"
      : "other";
  return {
    context,
    mine: t(context === "stash" ? "side.mine.stash" : "side.mine"),
    theirs: t(`side.theirs.${context}`),
  };
}

/** What a conflicted file's row says under its name. */
export function useConflictNote(operation: Operation | null) {
  const { t } = useI18n();
  const sides = useSides(operation);
  return ({ resolution, ...has }: Conflict) =>
    !resolution
      ? t("conflict.open")
      : resolution === "manual"
        ? t("conflict.keptManual")
        : !has[resolution]
          ? t("conflict.keptDeleted")
          : t("conflict.kept", { side: sides[resolution] });
}

const title = ({ mine, theirs }: Conflict): Key =>
  mine && theirs
    ? "conflict.title.both"
    : !mine && !theirs
      ? "conflict.title.bothDeleted"
      : mine
        ? "conflict.title.deletedByThem"
        : "conflict.title.deletedByMe";

/**
 * A file both sides changed: one button per version, and the two versions
 * side by side through the usual previews. An asset and its .meta file are
 * settled together.
 */
export function ConflictView({
  repo,
  group,
}: {
  repo: RepoApi;
  group: FileGroup;
}) {
  const { snapshot, act } = repo;
  const { t, mode } = useI18n();
  const sides = useSides(snapshot.operation);
  const conflicted = groupFiles(group).filter((f) => f.conflict);
  const primary = primaryFile(group);
  const file = conflicted.includes(primary) ? primary : conflicted[0];
  const conflict = file.conflict!;
  const chosen = conflict.resolution;

  const settle = (side: Side | "manual") =>
    act(async (b) => {
      for (const f of conflicted)
        await (side === "manual"
          ? b.markResolved(f.path)
          : b.resolveConflict(f.path, side));
    });
  const choice = (side: Side, label: string) => (
    <button
      className={`button conflict-choice ${chosen === side ? "chosen" : ""}`}
      aria-pressed={chosen === side}
      onClick={() => chosen !== side && settle(side)}
    >
      {chosen === side && <Check size={15} />}
      {label}
    </button>
  );
  const kind = fileKind(file);
  // Fixing a file by hand means editing text; a picture can only be one version or the other.
  const byHand =
    mode === "full" &&
    kind === "code" &&
    conflict.mine &&
    conflict.theirs &&
    chosen !== "manual";

  const card = (
    <section className={`conflict-card ${chosen ? "resolved" : ""}`}>
      <div className="card-title">
        {chosen ? <CheckCircle2 /> : <GitMerge />}
        <strong>{t(title(conflict))}</strong>
      </div>
      <p className="card-hint">
        {t("conflict.hint")}
        {chosen && <> {t("conflict.changeMind")}</>}
      </p>
      <div className="conflict-choices">
        {choice(
          "mine",
          t(
            !conflict.mine
              ? "conflict.keepDeleted"
              : sides.context === "stash"
                ? "conflict.keepMine.stash"
                : "conflict.keepMine",
          ),
        )}
        {choice(
          "theirs",
          t(
            conflict.theirs
              ? `conflict.takeTheirs.${sides.context}`
              : `conflict.deleteTheirs.${sides.context}`,
          ),
        )}
      </div>
      {/* Pictures and models are captioned; text and cards need the direction spelled out. */}
      {conflict.mine &&
        conflict.theirs &&
        kind !== "image" &&
        kind !== "model" && (
          <p className="conflict-compare muted">
            {t(`conflict.compare.${sides.context}`)}
          </p>
        )}
      {byHand && (
        <p className="conflict-manual muted">
          {t("conflict.manualHint")}{" "}
          <button
            className="text-button accent"
            onClick={() => settle("manual")}
          >
            {t("conflict.markResolved")}
          </button>
        </p>
      )}
    </section>
  );

  return (
    <SideLabels.Provider value={{ before: sides.mine, after: sides.theirs }}>
      <DiffView
        file={file}
        context={`${sides.mine} → ${sides.theirs}`}
        revisions={conflictRevisions(file, snapshot.operation)}
        banner={card}
      />
    </SideLabels.Provider>
  );
}
