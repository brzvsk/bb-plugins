import { atom } from "jotai";
import type {
  PluginSidebarThread,
  PluginSidebarThreadsState,
} from "@get-bb/plugin-sdk/app";

export const threadSearchQueryAtom = atom("");

export const isThreadSearchActiveAtom = atom(
  (get) => searchTerms(get(threadSearchQueryAtom)).length > 0,
);

export function searchTerms(query: string): string[] {
  return query.toLocaleLowerCase().split(/\s+/u).filter(Boolean);
}

function threadTitle(thread: PluginSidebarThread): string {
  return (thread.displayTitle || thread.title || thread.titleFallback || "")
    .toLocaleLowerCase();
}

/**
 * Keeps threads whose title contains every query term, plus the ancestors
 * that nest them, and drops projects left without a match. Returns the same
 * state object when the query is empty so bb's memoized views stay stable.
 */
export function filterSidebarThreadsState<
  State extends Pick<PluginSidebarThreadsState, "threads" | "projects">,
>(state: State, query: string): State {
  const terms = searchTerms(query);
  if (terms.length === 0) return state;
  const byId = new Map(state.threads.map((thread) => [thread.id, thread]));
  const keep = new Set<string>();
  for (const thread of state.threads) {
    const title = threadTitle(thread);
    if (!terms.every((term) => title.includes(term))) continue;
    let current: PluginSidebarThread | undefined = thread;
    while (current !== undefined && !keep.has(current.id)) {
      keep.add(current.id);
      current =
        current.parentThreadId === null
          ? undefined
          : byId.get(current.parentThreadId);
    }
  }
  const threads = state.threads.filter((thread) => keep.has(thread.id));
  const projectIds = new Set(threads.map((thread) => thread.projectId));
  const projects = state.projects.filter((project) =>
    projectIds.has(project.id),
  );
  return { ...state, threads, projects };
}
