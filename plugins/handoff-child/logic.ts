export const PLUGIN_ID = 'handoff-child';

export type Notifications = 'auto' | 'off';

export type ChildRequest = {
  kind: 'handoff-child';
  sourceThreadId: string;
  notifications: Notifications;
};

type Scope = { kind: string; threadId?: string };
type Mention = { kind: string; threadId?: string };

// The handoff draft starts with "Continue from @thread:<this thread>"; the SDK
// exposes no handoff flag, so that mention is the signal.
export function handoffSource(scope: Scope, mentions: readonly Mention[]): string | null {
  if (scope.kind !== 'thread' || !scope.threadId) return null;
  return mentions.some(m => m.kind === 'thread' && m.threadId === scope.threadId) ? scope.threadId : null;
}

export function readRequest(
  submission: { pluginId: string; data: unknown } | null | undefined,
): ChildRequest | null {
  if (submission?.pluginId !== PLUGIN_ID) return null;
  const data = submission.data as Partial<ChildRequest> | null;
  if (!data || typeof data !== 'object' || data.kind !== 'handoff-child') return null;
  if (typeof data.sourceThreadId !== 'string' || !data.sourceThreadId) return null;
  if (data.notifications !== 'auto' && data.notifications !== 'off') return null;
  return { kind: 'handoff-child', sourceThreadId: data.sourceThreadId, notifications: data.notifications };
}

// Adopt only the new thread a handoff created: never the source itself (a plain
// follow-up) and never a thread that already has a parent.
export function shouldAdopt(thread: { id: string; parentThreadId: string | null }, request: ChildRequest): boolean {
  return thread.id !== request.sourceThreadId && thread.parentThreadId === null;
}
