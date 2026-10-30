import { type ReactNode } from "react";
import { formatAmount } from "../../src/format.js";
import type { AgentUsage } from "../../src/report.js";

export function agentTotal(agents: AgentUsage | undefined): number {
  return agents?.rows.reduce((n, a) => n + a.cost.total, 0) ?? 0;
}
export function agentLabel(agents: AgentUsage | undefined): string {
  if (!agents || (agents.coverage === "partial" && agents.rows.length === 0)) return "Unavailable";
  const value = formatAmount(agentTotal(agents), agents.rows.some(a => a.estimated));
  return agents.coverage === "partial" ? `≥ ${value}` : value;
}

/** Nested rows are a subset of the owning thread's row, not new rows to sum. */
export function AgentRows({ agents }: { agents?: AgentUsage }): ReactNode {
  if (!agents || agents.rows.length === 0) return null;
  return <details className="border-t border-border px-3 py-2 pl-8 text-[11.5px] text-muted-foreground" data-testid="agent-rows">
    <summary className="cursor-pointer">↳ Subagents · {agents.rows.length}<span className="float-right tabular-nums">{agentLabel(agents)} · of the thread total</span></summary>
    {agents.rows.map((a, i) => <div key={a.id} className="mt-1.5 flex items-baseline justify-between gap-2 pl-3">
      <span className="min-w-0 truncate" title={a.id}>Subagent {i + 1}</span>
      <span className="shrink-0 tabular-nums">{a.calls} calls · {formatAmount(a.cost.total, a.estimated)}</span>
    </div>)}
  </details>;
}
