import { useEffect, useRef, useState } from "react";
import { firstLine } from "./format";

/** What the second line shows: the newest thing that happened in the thread. */
export interface Preview {
  kind: "user" | "agent" | "thinking" | "tool";
  text: string;
}

export interface EventRow {
  type: string;
  data?: unknown;
}

interface EventsClient {
  events: { list(args: { threadId: string; order?: "asc" | "desc"; limit?: string; types?: readonly [string, ...string[]] }): Promise<readonly EventRow[]> };
}

const EVENT_TYPES = ["client/turn/requested", "item/completed", "item/started"] as const;
/** bb's own notices (child completions and the like) arrive as user turns: "[bb system] …". */
const SYSTEM_NOTICE = /^\[bb[ \]]/i;

type Obj = Record<string, unknown>;
const obj = (v: unknown): Obj | null => (v && typeof v === "object" ? (v as Obj) : null);
const str = (v: unknown): string => (typeof v === "string" ? v : "");

function presentation(item: Obj, pending: boolean): string | null {
  const p = obj(item.presentation);
  if (!p) return null;
  const label = obj(p.label);
  const verb = str(label?.[pending ? "pending" : "completed"]) || str(label?.completed) || str(label?.pending);
  const title = firstLine(str(p.title));
  const text = [verb, title].filter(Boolean).join(" · ");
  return text || null;
}

/** The newest user turn, agent message, thought or tool step among events listed newest first. */
export function latestActivity(eventsNewestFirst: readonly EventRow[]): Preview | null {
  for (const e of eventsNewestFirst) {
    const data = obj(e.data);
    if (!data) continue;
    if (e.type === "client/turn/requested") {
      if (data.initiator !== "user") continue;
      const kind = str(data.systemMessageKind);
      if (kind && kind !== "unlabeled") continue;
      const input = Array.isArray(data.input) ? data.input : [];
      const text = firstLine(input.map(part => str(obj(part)?.text)).filter(Boolean).join("\n"));
      if (text && !SYSTEM_NOTICE.test(text)) return { kind: "user", text };
      continue;
    }
    const item = obj(data.item);
    if (!item) continue;
    const started = e.type === "item/started";
    switch (item.type) {
      case "agentMessage": {
        const text = firstLine(str(item.text));
        if (text && !started) return { kind: "agent", text };
        continue;
      }
      case "reasoning": {
        const parts = [...(Array.isArray(item.summary) ? item.summary : []), ...(Array.isArray(item.content) ? item.content : [])];
        const text = firstLine(parts.map(str).filter(Boolean).join("\n"));
        if (text) return { kind: "thinking", text };
        if (started) return { kind: "thinking", text: "…" };
        continue;
      }
      default: {
        const text = presentation(item, started);
        if (text) return { kind: "tool", text };
      }
    }
  }
  return null;
}

const CONCURRENCY = 4;
const LIVE_REFRESH_MS = 3000;

/**
 * The newest activity in each of the given threads as a one-line preview, fetched a few at a
 * time and refreshed when a thread's `updatedAt` moves; `live` threads (an agent is working)
 * refresh every few seconds so their progress shows. A fetch in flight always lands; a thread
 * that changed meanwhile is fetched again after it.
 */
export function usePreviews(client: EventsClient, threads: readonly { id: string; updatedAt: number; live?: boolean }[]): ReadonlyMap<string, Preview | null> {
  const [previews, setPreviews] = useState<ReadonlyMap<string, Preview | null>>(new Map());
  const loaded = useRef(new Map<string, number>());
  const inFlight = useRef(new Set<string>());
  const wanted = useRef(new Map<string, number>());
  const mounted = useRef(true);
  const [tick, setTick] = useState(0);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  const liveIds = threads.filter(t => t.live).map(t => t.id).join(",");
  useEffect(() => {
    if (!liveIds) return;
    const ids = liveIds.split(",");
    const timer = setInterval(() => {
      for (const id of ids) loaded.current.delete(id);
      setTick(n => n + 1);
    }, LIVE_REFRESH_MS);
    return () => clearInterval(timer);
  }, [liveIds]);
  const key = threads.map(t => `${t.id}:${t.updatedAt}`).join(",");
  useEffect(() => {
    wanted.current = new Map(threads.map(t => [t.id, t.updatedAt] as const));
    const queue = threads.filter(t => loaded.current.get(t.id) !== t.updatedAt && !inFlight.current.has(t.id));
    const slots = Math.max(1, CONCURRENCY - inFlight.current.size);
    const next = async (): Promise<void> => {
      const t = queue.shift();
      if (!t || !mounted.current) return;
      inFlight.current.add(t.id);
      try {
        const events = await client.events.list({ threadId: t.id, order: "desc", limit: "60", types: EVENT_TYPES });
        if (!mounted.current) return;
        loaded.current.set(t.id, t.updatedAt);
        const preview = latestActivity(events);
        setPreviews(prev => new Map(prev).set(t.id, preview));
      } catch {
        // Leave the row as it was; the next change or live tick retries.
        loaded.current.set(t.id, t.updatedAt);
      } finally {
        inFlight.current.delete(t.id);
      }
      await next();
    };
    void Promise.all(Array.from({ length: slots }, next)).then(() => {
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
