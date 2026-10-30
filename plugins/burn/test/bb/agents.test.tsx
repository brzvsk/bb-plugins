// @vitest-environment jsdom
import { cleanup, render } from "@testing-library/react";
import { afterEach, expect, it } from "vitest";
import { agentLabel, AgentRows } from "../../extensions/bb/agents.js";
import { applyDiscounts } from "../../src/discounts.js";
import { buildReport } from "../../src/report.js";
import { assistant } from "../helpers.js";
afterEach(cleanup);

it("keeps agent spend inside report totals and discounts its token kinds exactly", () => {
  const r = buildReport([assistant(3), { ...assistant(2), agentId: "native" }], null);
  expect(r.cost.total).toBe(5);
  expect(r.agents!.rows[0]!.cost.total).toBe(2);
  const priced = applyDiscounts(r, { input: 50, output: 0, cacheRead: 0, cacheWrite: 0 });
  expect(priced.agents!.rows[0]!.cost.total).toBe(1.5);
  expect(r.agents!.rows[0]!.cost.total).toBe(2);
  expect(agentLabel(undefined)).toBe("Unavailable");
  expect(agentLabel({ coverage: "partial", rows: [] })).toBe("Unavailable");
});

it("expands native rows as parts of their thread total", () => {
  const r = buildReport([{ ...assistant(2), agentId: "native" }], null);
  const ui = render(<AgentRows agents={r.agents} />);
  expect(ui.getByText(/of the thread total/)).toBeTruthy();
  expect(ui.getByText("Subagent 1")).toBeTruthy();
});

it("renders nothing when the source has no agent rows", () => {
  const ui = render(<AgentRows agents={{ coverage: "available", rows: [] }} />);
  expect(ui.container.innerHTML).toBe("");
});
