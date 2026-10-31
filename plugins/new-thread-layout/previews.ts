import { useEffect, useRef, useState } from "react";
import { firstLine } from "./format";

/** What the second line shows: the newest thing said in the thread. */
export interface Preview {
  kind: "user" | "agent" | "thinking";
  text: string;
}

export interface EventRow {
  type: string;
  data?: unknown;
}

interface EventsClient {
  events: { list(args: { threadId: string; order?: "asc" | "desc"; limit?: string; types?: readonly [string, ...string[]] }): Promise<readonly EventRow[]> };
}

const EVENT_TYPES = ["client/turn/requested", "item/completed", "item/reasoning/textDelta", "item/reasoning/summaryTextDelta", "item/agentMessage/delta"] as const;
const DELTA_KIND: Record<string, Preview["kind"]> = {
  "item/reasoning/textDelta": "thinking",
  "item/reasoning/summaryTextDelta": "thinking",
  "item/agentMessage/delta": "agent",
};
/** bb's own notices (child completions and the like) arrive as user turns: "[bb system] …". */
const SYSTEM_NOTICE = /^\[bb[ \]]/i;

type Obj = Record<string, unknown>;
const obj = (v: unknown): Obj | null => (v && typeof v === "object" ? (v as Obj) : null);
const str = (v: unknown): string => (typeof v === "string" ? v : "");

/**
 * The newest author turn, agent message or thought among events listed newest first. Tool steps
 * are skipped. A thought or reply still streaming is pieced together from its deltas; one with no
 * text yet gives way to the event before it.
 */
export function latestActivity(eventsNewestFirst: readonly EventRow[]): Preview | null {
  let streaming: { itemId: string; kind: Preview["kind"]; parts: string[] } | null = null;
  const flush = (): Preview | null => {
    if (!streaming) return null;
    const text = firstLine(streaming.parts.slice().reverse().join(""));
    const kind = streaming.kind;
    streaming = null;
    return text ? { kind, text } : null;
  };
  for (const e of eventsNewestFirst) {
    const data = obj(e.data);
    if (!data) continue;
    const deltaKind = DELTA_KIND[e.type];
    if (deltaKind) {
      const itemId = str(data.itemId);
      if (streaming && streaming.itemId !== itemId) {
        const done = flush();
        if (done) return done;
      }
      streaming ??= { itemId, kind: deltaKind, parts: [] };
      streaming.parts.push(str(data.delta));
      continue;
    }
    const item = obj(data.item);
    // The completed item of the deltas being collected supersedes them; any other event ends them.
    if (streaming && !(e.type === "item/completed" && item && str(item.id) === streaming.itemId)) {
      const done = flush();
      if (done) return done;
    }
    streaming = null;
    if (e.type === "client/turn/requested") {
      if (data.initiator !== "user") continue;
      const kind = str(data.systemMessageKind);
      if (kind && kind !== "unlabeled") continue;
      const input = Array.isArray(data.input) ? data.input : [];
      const text = firstLine(input.map(part => str(obj(part)?.text)).filter(Boolean).join("\n"));
      if (text && !SYSTEM_NOTICE.test(text)) return { kind: "user", text };
      continue;
    }
    if (!item) continue;
    if (item.type === "agentMessage") {
      const text = firstLine(str(item.text));
      if (text) return { kind: "agent", text };
    } else if (item.type === "reasoning") {
      const parts = [...(Array.isArray(item.summary) ? item.summary : []), ...(Array.isArray(item.content) ? item.content : [])];
      const text = firstLine(parts.map(str).filter(Boolean).join("\n"));
      if (text) return { kind: "thinking", text };
    }
  }
  return flush();
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
        const events = await client.events.list({ threadId: t.id, order: "desc", limit: "80", types: EVENT_TYPES });
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
