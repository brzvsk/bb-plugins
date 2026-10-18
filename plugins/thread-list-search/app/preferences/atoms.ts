import { atom, type SetStateAction } from "jotai";
import type { PreferenceValue } from "../../shared/preferences.js";
import { isThreadSearchActiveAtom } from "../search/thread-search.js";
import {
  createSyncedPreferenceAtom,
  type SyncedPreferenceAtom,
} from "./synced-preference-atom.js";

type FoldPreferenceKey =
  | "collapsedProjects"
  | "collapsedThreads"
  | "collapsedEnvironments"
  | "collapsedSections"
  | "hiddenGroups"
  | "collapsedThreadSections"
  | "collapsedMachines";

// While a search is active every group is expanded and nothing sits in More,
// so a match is never hidden behind a fold. Toggles made then are dropped
// instead of overwriting the saved folds with the temporary empty view.
function unfoldedWhileSearching<Key extends FoldPreferenceKey>(
  base: SyncedPreferenceAtom<Key>,
): SyncedPreferenceAtom<Key> {
  const unfolded = [] as PreferenceValue<Key>;
  return atom(
    (get) => (get(isThreadSearchActiveAtom) ? unfolded : get(base)),
    (get, set, update: SetStateAction<PreferenceValue<Key>>) => {
      if (get(isThreadSearchActiveAtom)) return;
      set(base, update);
    },
  );
}

export const collapsedProjectIdsAtom =
  unfoldedWhileSearching(createSyncedPreferenceAtom("collapsedProjects"));
export const collapsedThreadIdsAtom =
  unfoldedWhileSearching(createSyncedPreferenceAtom("collapsedThreads"));
export const collapsedEnvironmentIdsAtom = unfoldedWhileSearching(createSyncedPreferenceAtom("collapsedEnvironments"));
export const collapsedSidebarSectionIdsAtom =
  unfoldedWhileSearching(createSyncedPreferenceAtom("collapsedSections"));
export const sidebarSectionOrderAtom =
  createSyncedPreferenceAtom("sectionOrder");
export const sidebarManualSectionOrderAtom =
  createSyncedPreferenceAtom("manualSectionOrder");
export const sidebarMachineSectionOrderAtom = createSyncedPreferenceAtom(
  "machineSectionOrder",
);
export const sidebarHiddenGroupsAtom =
  unfoldedWhileSearching(createSyncedPreferenceAtom("hiddenGroups"));
export const threadRowActionsAtom = createSyncedPreferenceAtom("rowActions");
export const sidebarOrganizationModeAtom =
  createSyncedPreferenceAtom("organizationMode");
export const sidebarEnvironmentGroupingAtom = createSyncedPreferenceAtom(
  "environmentGrouping",
);
export const sidebarGroupByReadStatusAtom =
  createSyncedPreferenceAtom("groupByReadStatus");
export const sidebarGroupThreadsByEnvironmentAtom = atom((get) => {
  if (get(sidebarGroupByReadStatusAtom)) return false;
  const grouping = get(sidebarEnvironmentGroupingAtom);
  if (grouping !== "auto") return grouping;
  return get(sidebarOrganizationModeAtom) !== "chronological";
});
export const sidebarChronologicalSortAtom =
  createSyncedPreferenceAtom("chronologicalSort");
export const sidebarSortDirectionAtom =
  createSyncedPreferenceAtom("sortDirection");
export const sidebarCollapsedThreadSectionsAtom = unfoldedWhileSearching(createSyncedPreferenceAtom("collapsedThreadSections"));
export const sidebarCollapsedMachinesAtom =
  unfoldedWhileSearching(createSyncedPreferenceAtom("collapsedMachines"));

export const sidebarThreadLifecyclesAtom =
  createSyncedPreferenceAtom("threadLifecycles");
export const sidebarShowProviderIconsAtom =
  createSyncedPreferenceAtom("showProviderIcons");
