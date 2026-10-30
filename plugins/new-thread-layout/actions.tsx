import {
  experimental_Icon as Icon,
  experimental_ThreadActionsContextMenu as ThreadContextMenu,
  experimental_ThreadActionsMenu as ThreadMenu,
  experimental_useRpcQuery,
  experimental_useThreadActions,
  type PluginSidebarThread,
  type PluginThreadActionTarget,
} from "@get-bb/plugin-sdk/app";
import { useState, type ReactNode } from "react";
import { threadListContract } from "./contracts";

/** The quick actions the author picked for thread-list rows (Customize actions). */
export function useRowActionKeys(): readonly string[] {
  const prefs = experimental_useRpcQuery({ pluginId: "thread-list", contract: threadListContract, method: "listPreferences", input: null });
  return prefs.data?.preferences.rowActions ?? [];
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
            .filter(e => !e.action.choices)
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
