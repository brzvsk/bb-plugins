import {
  experimental_Icon as Icon, experimental_ThreadActionsMenu as ThreadActionsMenu,
  type PluginThreadActionTarget, type PluginThreadActionsTriggerProps,
} from '@get-bb/plugin-sdk/app';
import { useEffect, useState, useSyncExternalStore } from 'react';
import { createPortal } from 'react-dom';

/** A place in plugin-drawn DOM that should hold bb's own thread menu. */
export interface MenuSlot {
  element: HTMLElement;
  thread: PluginThreadActionTarget;
}

// The content script draws rows outside React; these bridges, mounted in React
// slots, portal bb's menu into them. Only the first mounted bridge renders, so
// split panes or the home screen never draw a menu twice.
let slots: readonly MenuSlot[] = [];
const listeners = new Set<() => void>();
const bridges: symbol[] = [];
const bridgeListeners = new Set<() => void>();

export function publishMenuSlots(next: readonly MenuSlot[]): void {
  if (next.length === slots.length && next.every((slot, index) => slot.element === slots[index]?.element)) return;
  slots = next;
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => void listeners.delete(listener);
}

function useLeader(): boolean {
  const [id] = useState(() => Symbol('bridge'));
  const [, rerender] = useState(0);
  useEffect(() => {
    bridges.push(id);
    const notify = () => rerender(value => value + 1);
    bridgeListeners.add(notify);
    for (const listener of bridgeListeners) listener();
    return () => {
      bridges.splice(bridges.indexOf(id), 1);
      bridgeListeners.delete(notify);
      for (const listener of bridgeListeners) listener();
    };
  }, [id]);
  return bridges[0] === id;
}

// bb's own sidebar row button look (ghost icon button), from its stylesheet.
const ROW_BUTTON_CLASS = 'inline-flex items-center justify-center whitespace-nowrap transition-colors duration-150 hover:duration-0 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring [&_[data-icon-root]]:pointer-events-none [&_[data-icon-root]]:size-4 [&_[data-icon-root]]:shrink-0 h-7 w-7 text-subtle-foreground hover:text-muted-foreground data-[state=open]:text-muted-foreground hover:bg-state-hover active:bg-state-active data-[state=open]:bg-state-active data-[state=open]:text-foreground relative m-0 shrink-0 cursor-pointer rounded-md p-0 outline-none';

function trigger(props: PluginThreadActionsTriggerProps) {
  return (
    <button
      {...props}
      type="button"
      className={`${props.className ?? ''} ${ROW_BUTTON_CLASS}`}
      aria-label="Thread actions"
      onClick={event => {
        props.onClick?.(event);
        event.stopPropagation();
      }}
    >
      <Icon name="MoreHorizontal" />
    </button>
  );
}

export function MenuBridge() {
  const leader = useLeader();
  const current = useSyncExternalStore(subscribe, () => slots);
  if (!leader) return <span hidden />;
  return (
    <span hidden data-sidebar-focus-bridge="">
      {current.map(slot => createPortal(
        <ThreadActionsMenu thread={slot.thread} trigger={trigger} side="bottom" align="end" />,
        slot.element,
        slot.thread.id,
      ))}
    </span>
  );
}
