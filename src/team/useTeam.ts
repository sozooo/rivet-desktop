import { useEffect, useMemo, useState } from "react";
import { ACTIVITY_DAYS, type BranchActivity } from "../git/activity";
import type { GitBackend } from "../git/backend";
import type { RepoSnapshot } from "../git/types";
import { useAccount } from "../github/account";
import type { RepoApi } from "../views/repoApi";
import { useGitHubPictures } from "./githubPictures";
import { myEmails } from "./members";

/** One request per snapshot, shared by the toolbar and the Branches view. */
const requests = new WeakMap<RepoSnapshot, Promise<BranchActivity>>();

/**
 * Who worked on which branch, asked again with every new snapshot: after
 * commits, fetches, syncs and switching. The backend answers from its cache
 * while no branch moved. Keeps the last answer while the next one loads.
 */
export function useBranchActivity(
  backend: GitBackend,
  snapshot: RepoSnapshot | undefined,
) {
  const [state, setState] = useState<{
    backend: GitBackend;
    activity: BranchActivity;
  }>();
  useEffect(() => {
    if (!snapshot) return;
    let live = true;
    let request = requests.get(snapshot);
    if (!request) {
      request = backend.branchActivity(ACTIVITY_DAYS);
      requests.set(snapshot, request);
    }
    // Nothing to show is fine: the team view just stays away.
    request.then(
      (activity) => live && setState({ backend, activity }),
      () => {},
    );
    return () => {
      live = false;
    };
  }, [backend, snapshot]);
  return state?.backend === backend ? state.activity : undefined;
}

/**
 * The team view's data: activity, who "me" is, and people's pictures. The
 * snapshot may still be loading, for the workspace's own top bar.
 */
export function useTeam({
  backend,
  snapshot,
}: Pick<RepoApi, "backend"> & { snapshot: RepoSnapshot | undefined }) {
  const activity = useBranchActivity(backend, snapshot);
  const { user } = useAccount();
  const email = snapshot?.user.email ?? "";
  const mine = useMemo(() => myEmails(email, user), [email, user]);
  const picture = useGitHubPictures(activity, user, mine);
  return { activity, mine, picture };
}

export type Team = ReturnType<typeof useTeam>;
