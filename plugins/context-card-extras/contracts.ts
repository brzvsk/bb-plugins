import { z } from "zod";

// Minimal client-side views of two bundled plugins' RPC methods. Only the
// fields this plugin reads are declared; everything else passes through.

const gitStatusRow = z.looseObject({
  outcome: z.string(),
  workspace: z
    .looseObject({
      branch: z.looseObject({ currentBranch: z.string().nullable().optional() }).optional(),
      checkout: z.looseObject({ kind: z.string(), branchName: z.string().nullable().optional(), headSha: z.string().nullable().optional() }).optional(),
      mergeBase: z
        .looseObject({
          mergeBaseBranch: z.string().nullable().optional(),
          aheadCount: z.number().optional(),
          behindCount: z.number().optional(),
        })
        .nullable()
        .optional(),
    })
    .optional(),
});
export type GitStatusRow = z.infer<typeof gitStatusRow>;

export const gitContract = {
  status: {
    input: z.object({ keys: z.array(z.string()) }),
    output: z.record(z.string(), gitStatusRow),
  },
} as const;

const automation = z.looseObject({
  id: z.string(),
  projectId: z.string(),
  name: z.string(),
  enabled: z.boolean().optional(),
  nextRunAt: z.number().nullable().optional(),
  lastRunStatus: z.string().nullable().optional(),
  problem: z.string().optional(),
});
export type Automation = z.infer<typeof automation>;

export const automationsContract = {
  automations_list: {
    input: z.object({ targetThreadId: z.string() }),
    output: z.array(automation),
  },
} as const;
