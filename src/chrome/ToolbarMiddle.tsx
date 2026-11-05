import { Search } from "../search/Search";
import { Team } from "../team/Team";
import type { RepoApi } from "../views/repoApi";

/** The middle of the toolbar: search, and who works on which branch. */
export function ToolbarMiddle({ repo }: { repo: RepoApi }) {
  return (
    <div className="toolbar-middle">
      <Search repo={repo} />
      <Team repo={repo} />
    </div>
  );
}
