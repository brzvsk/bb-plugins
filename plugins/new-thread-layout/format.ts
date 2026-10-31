const DAY_MS = 24 * 60 * 60 * 1000;

/** "Today, 12:00", "Tomorrow, 9:00", "Monday, 9:00" within the week, then "11 Nov, 22:00"; null for no upcoming run. */
export function formatNextRun(at: number | null | undefined, now: number): string | null {
  if (at == null || at < now) return null;
  const date = new Date(at);
  const time = `${date.getHours()}:${String(date.getMinutes()).padStart(2, "0")}`;
  const today = new Date(now);
  today.setHours(0, 0, 0, 0);
  const days = Math.floor((new Date(at).setHours(0, 0, 0, 0) - today.getTime()) / DAY_MS);
  if (days === 0) return `Today, ${time}`;
  if (days === 1) return `Tomorrow, ${time}`;
  if (days < 7) return `${date.toLocaleString("en-GB", { weekday: "long" })}, ${time}`;
  const month = date.toLocaleString("en-GB", { month: "short" });
  return `${date.getDate()} ${month}, ${time}`;
}

/** Messenger-style stamp for the last message: "10:42" today, "Mon" within the week, "28 Oct" before. */
export function formatStamp(at: number, now: number): string {
  const date = new Date(at);
  const today = new Date(now);
  today.setHours(0, 0, 0, 0);
  const days = Math.floor((today.getTime() - new Date(at).setHours(0, 0, 0, 0)) / DAY_MS);
  if (days <= 0) return `${date.getHours()}:${String(date.getMinutes()).padStart(2, "0")}`;
  if (days < 7) return date.toLocaleString("en-GB", { weekday: "short" });
  return `${date.getDate()} ${date.toLocaleString("en-GB", { month: "short" })}`;
}

/** "just now", "5 min ago", "3 h ago", "yesterday", "4 days ago". */
export function formatAgo(at: number, now: number): string {
  const diff = Math.max(0, now - at);
  const min = Math.round(diff / 60_000);
  if (min < 1) return "just now";
  if (min < 60) return `${min} min ago`;
  const h = Math.round(min / 60);
  if (h < 24) return `${h} h ago`;
  const days = Math.round(h / 24);
  return days === 1 ? "yesterday" : `${days} days ago`;
}

/** The first non-empty line of a message preview, whitespace collapsed. */
export function firstLine(text: string): string {
  const line = text.split(/\r?\n/).map(l => l.trim()).find(l => l.length > 0) ?? "";
  return line
    .replace(/^(?:#{1,6}\s+|>\s+|[-*]\s+|\d+\.\s+)/, "")
    .replace(/\*\*|__|`/g, "")
    .replace(/\s+/g, " ");
}

/**
 * The text of a thread's unsent composer draft, as bb keeps it in this window's localStorage
 * (`bb.promptbox.contents-<project>-<thread>-<version>` → `{ text, attachments }`); null without one.
 */
export function readDraft(projectId: string, threadId: string, storage: Pick<Storage, "length" | "key" | "getItem"> = localStorage): string | null {
  const prefix = `bb.promptbox.contents-${projectId}-${threadId}-`;
  try {
    for (let i = 0; i < storage.length; i++) {
      const key = storage.key(i);
      if (!key?.startsWith(prefix)) continue;
      const parsed = JSON.parse(storage.getItem(key) ?? "null") as { text?: unknown } | null;
      const text = typeof parsed?.text === "string" ? firstLine(parsed.text) : "";
      if (text) return text;
    }
  } catch {
    // Unreadable storage or an unexpected shape: no draft line.
  }
  return null;
}
