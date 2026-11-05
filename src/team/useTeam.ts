import { useEffect, useMemo, useState } from "react";
import {
  ACTIVITY_DAYS,
  HISTORY_DAYS,
  type BranchActivity,
} from "../git/activity";
import type { GitBackend } from "../git/backend";
import type { RepoSnapshot } from "../git/types";
import { useAccount } from "../github/account";
import type { RepoApi } from "../views/repoApi";
import { useGitHubPictures } from "./githubPictures";
import { myEmails } from "./members";

/** One request per snapshot and window, shared by the toolbar, menu and Branches view. */
const requests = new WeakMap<
  RepoSnapshot,
  Map<number, Promise<BranchActivity>>
>();

/**
 * Who worked on which branch, asked again with every new snapshot: after
 * commits, fetches, syncs and switching. The backend answers from its cache
 * while no branch moved. Keeps the last answer while the next one loads.
 */
export function useBranchActivity(
  backend: GitBackend,
  snapshot: RepoSnapshot | undefined,
  days = ACTIVITY_DAYS,
) {
  const [state, setState] = useState<{
    backend: GitBackend;
    activity: BranchActivity;
  }>();
  useEffect(() => {
    if (!snapshot) return;
    let live = true;
    let windows = requests.get(snapshot);
    if (!windows) requests.set(snapshot, (windows = new Map()));
    let request = windows.get(days);
    if (!request) {
      request = backend.branchActivity(days);
      windows.set(days, request);
    }
    // Nothing to show is fine: the team view just stays away.
    request.then(
      (activity) => live && setState({ backend, activity }),
      () => {},
    );
    return () => {
      live = false;
    };
  }, [backend, snapshot, days]);
  return state?.backend === backend ? state.activity : undefined;
}

/**
 * The team view's data: who worked where lately (`activity`, for "who is on
 * which branch now") and over the last year (`history`, for whose branch it
 * is), who "me" is, and people's pictures. The snapshot may still be loading,
 * for the workspace's own top bar.
 */
export function useTeam({
  backend,
  snapshot,
}: Pick<RepoApi, "backend"> & { snapshot: RepoSnapshot | undefined }) {
  const activity = useBranchActivity(backend, snapshot);
  const history = useBranchActivity(backend, snapshot, HISTORY_DAYS);
  const { user } = useAccount();
  const email = snapshot?.user.email ?? "";
  const mine = useMemo(() => myEmails(email, user), [email, user]);
  // The year's people include the last two weeks'.
  const picture = useGitHubPictures(history, user, mine);
  return { activity, history, mine, picture };
}

export type Team = ReturnType<typeof useTeam>;
