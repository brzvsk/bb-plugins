import {
  experimental_Icon as Icon,
  experimental_ThreadActionsContextMenu as ThreadContextMenu,
  experimental_ThreadActionsMenu as ThreadMenu,
  experimental_useRpcQuery,
  experimental_useThreadActions,
  type PluginSidebarThread,
  type PluginThreadActionTarget,
} from "@get-bb/plugin-sdk/app";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { threadListContract } from "./contracts";

function useThreadListPreferencesQuery() {
  return experimental_useRpcQuery({ pluginId: "thread-list", contract: threadListContract, method: "listPreferences", input: null });
}

function useThreadListPreferences() {
  return useThreadListPreferencesQuery().data?.preferences;
}

/** The quick actions the author picked for thread-list rows (Customize actions). */
export function useRowActionKeys(): readonly string[] {
  return useThreadListPreferences()?.rowActions ?? [];
}

/** The sidebar's project order and hidden projects, as the author arranged the thread list. */
export function useProjectArrangement(view?: string | null): { order: readonly string[]; hidden: readonly string[] } {
  const query = useThreadListPreferencesQuery();
  // bb does not push preference changes to other readers, so a reorder in the sidebar would reach us
  // only after a reload: read again for every screen shown (`view`) and whenever the window regains focus.
  const refetch = useRef(query.refetch);
  refetch.current = query.refetch;
  useEffect(() => {
    void refetch.current();
    const onFocus = () => void refetch.current();
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [view]);
  const prefs = query.data?.preferences;
  return { order: prefs?.sectionOrder ?? [], hidden: prefs?.hiddenGroups ?? [] };
}

export function actionTarget(t: PluginSidebarThread): PluginThreadActionTarget {
  return {
    id: t.id,
    projectId: t.projectId,
    parentThreadId: t.parentThreadId,
    parentNotifications: t.parentNotifications,
    archivedAt: t.archivedAt,
    pinnedAt: t.pinnedAt,
    sectionId: t.sectionId,
    isUnread: t.isUnread,
    status: t.status,
    environment: t.environment?.id ? { id: t.environment.id, path: t.environment.path ?? null } : null,
  };
}

const PIN_KEY = "bb--core/pin";

/**
 * Pin / unpin from the row's left slot, where the status glyph sits: the glyph has priority, the
 * pin shows on hover; without a status a pinned row keeps showing its pin.
 */
export function PinToggle({ thread }: { thread: PluginSidebarThread }) {
  const [entry] = experimental_useThreadActions(actionTarget(thread), { keys: [PIN_KEY] });
  if (!entry) return null;
  return (
    <button
      type="button"
      className="ph-pin"
      aria-label={entry.action.label}
      title={entry.action.label}
      aria-pressed={thread.isPinned}
      disabled={entry.action.disabled}
      onClick={e => {
        stop(e);
        void entry.action.run();
      }}
    >
      <Icon name="Pin" className="ph-pin-icon" aria-hidden />
    </button>
  );
}

function stop(e: React.SyntheticEvent) {
  e.preventDefault();
  e.stopPropagation();
}

/**
 * A row with bb's thread menu on right-click and, on hover, the thread list's
 * quick actions plus a ⋯ button opening the same menu.
 */
export function ThreadRowActions({ thread, keys, children }: { thread: PluginSidebarThread; keys: readonly string[]; children: ReactNode }) {
  const target = actionTarget(thread);
  const quick = experimental_useThreadActions(target, { keys });
  const [menuOpen, setMenuOpen] = useState(false);
  return (
    <ThreadContextMenu thread={target}>
      <div className="ph-row-wrap" data-ph-menu-open={menuOpen || undefined}>
        {children}
        <span className="ph-actions">
          {quick
            // Pinning lives in the row's left slot (PinToggle), not among the hover actions.
            .filter(e => !e.action.choices && e.key !== PIN_KEY)
            .map(e => (
              <button
                key={e.key}
                type="button"
                className="ph-action"
                aria-label={e.action.label}
                title={e.action.label}
                disabled={e.action.disabled}
                onClick={ev => {
                  stop(ev);
                  void e.action.run();
                }}
              >
                <Icon name={e.action.icon} className="ph-action-icon" aria-hidden />
              </button>
            ))}
          <ThreadMenu
            thread={target}
            align="end"
            onOpenChange={setMenuOpen}
            trigger={props => (
              <button
                {...props}
                type="button"
                className="ph-action"
                aria-label="Thread actions"
                title="Thread actions"
                onClick={ev => {
                  props.onClick?.(ev);
                  ev.stopPropagation();
                }}
              >
                <Icon name="MoreHorizontal" className="ph-action-icon" aria-hidden />
              </button>
            )}
          />
        </span>
      </div>
    </ThreadContextMenu>
  );
}
