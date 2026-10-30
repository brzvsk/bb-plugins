import { useEffect, useRef, useState } from "react";
import { firstLine } from "./format";

export interface Preview {
  role: "user" | "assistant";
  text: string;
}

interface OutlineClient {
  conversationOutline(args: { threadId: string }): Promise<{ items: readonly { role: "user" | "assistant"; preview: string }[] }>;
}

/** The last message of a conversation outline as a one-line preview; null when the thread has none yet. */
export function lastPreview(items: readonly { role: "user" | "assistant"; preview: string }[]): Preview | null {
  for (let i = items.length - 1; i >= 0; i--) {
    const text = firstLine(items[i].preview);
    if (text) return { role: items[i].role, text };
  }
  return null;
}

const CONCURRENCY = 4;

/**
 * Last-message previews for the given threads, fetched a few at a time and
 * refreshed when a thread's `updatedAt` moves. Keyed by thread id.
 */
export function usePreviews(client: OutlineClient, threads: readonly { id: string; updatedAt: number }[]): ReadonlyMap<string, Preview | null> {
  const [previews, setPreviews] = useState<ReadonlyMap<string, Preview | null>>(new Map());
  const loaded = useRef(new Map<string, number>());
  const inFlight = useRef(new Set<string>());
  const key = threads.map(t => `${t.id}:${t.updatedAt}`).join(",");
  useEffect(() => {
    let cancelled = false;
    const queue = threads.filter(t => loaded.current.get(t.id) !== t.updatedAt && !inFlight.current.has(t.id));
    const next = async () => {
      const t = queue.shift();
      if (!t || cancelled) return;
      inFlight.current.add(t.id);
      try {
        const { items } = await client.conversationOutline({ threadId: t.id });
        if (cancelled) return;
        loaded.current.set(t.id, t.updatedAt);
        const preview = lastPreview(items);
        setPreviews(prev => new Map(prev).set(t.id, preview));
      } catch {
        // Leave the row without a preview; the next updatedAt change retries.
      } finally {
        inFlight.current.delete(t.id);
      }
      await next();
    };
    void Promise.all(Array.from({ length: CONCURRENCY }, next));
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, client]);
  return previews;
}
