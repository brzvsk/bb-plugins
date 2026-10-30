import { useEffect, useRef, useState } from "react";
import { firstLine } from "./format";

export interface Preview {
  role: "user" | "assistant";
  text: string;
}

interface OutlineClient {
  conversationOutline(args: { threadId: string; role?: "user" | "assistant" }): Promise<{ items: readonly { role: "user" | "assistant"; preview: string }[] }>;
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
 * The author's last message in each of the given threads as a one-line preview, fetched a few at a time and
 * refreshed when a thread's `updatedAt` moves. Keyed by thread id. A fetch in
 * flight always lands; a thread that changed meanwhile is fetched again after it.
 */
export function usePreviews(client: OutlineClient, threads: readonly { id: string; updatedAt: number }[]): ReadonlyMap<string, Preview | null> {
  const [previews, setPreviews] = useState<ReadonlyMap<string, Preview | null>>(new Map());
  const loaded = useRef(new Map<string, number>());
  const inFlight = useRef(new Map<string, number>());
  const wanted = useRef(new Map<string, number>());
  const mounted = useRef(true);
  const [tick, setTick] = useState(0);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  const key = threads.map(t => `${t.id}:${t.updatedAt}`).join(",");
  useEffect(() => {
    wanted.current = new Map(threads.map(t => [t.id, t.updatedAt] as const));
    const queue = threads.filter(t => loaded.current.get(t.id) !== t.updatedAt && !inFlight.current.has(t.id));
    const slots = Math.max(0, CONCURRENCY - inFlight.current.size);
    const next = async (): Promise<void> => {
      const t = queue.shift();
      if (!t || !mounted.current) return;
      inFlight.current.set(t.id, t.updatedAt);
      try {
        const { items } = await client.conversationOutline({ threadId: t.id, role: "user" });
        if (!mounted.current) return;
        loaded.current.set(t.id, t.updatedAt);
        const preview = lastPreview(items);
        setPreviews(prev => new Map(prev).set(t.id, preview));
      } catch {
        // Leave the row without a preview; the next updatedAt change retries.
        loaded.current.set(t.id, t.updatedAt);
      } finally {
        inFlight.current.delete(t.id);
      }
      await next();
    };
    void Promise.all(Array.from({ length: Math.max(1, slots) }, next)).then(() => {
      // Threads that changed or were skipped while fetches were running get another pass.
      if (!mounted.current) return;
      for (const [id, at] of wanted.current) {
        if (loaded.current.get(id) !== at && !inFlight.current.has(id)) {
          setTick(n => n + 1);
          return;
        }
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, client, tick]);
  return previews;
}
