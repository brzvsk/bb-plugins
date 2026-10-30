import { z } from "zod";

// Minimal client-side view of the bundled Automations plugin's `automations_list`
// RPC. Only the fields this plugin reads are declared; everything else passes through.
const automation = z.looseObject({
  id: z.string(),
  projectId: z.string(),
  name: z.string(),
  enabled: z.boolean().optional(),
  nextRunAt: z.number().nullable().optional(),
  /** The thread an agent automation re-prompts; per-run automations have none. */
  execution: z.looseObject({ targetThreadId: z.string().nullable().optional() }).optional(),
  lastRunThreadId: z.string().nullable().optional(),
  lastRunStatus: z.string().nullable().optional(),
  problem: z.string().optional(),
});
export type Automation = z.infer<typeof automation>;

export const automationsContract = {
  automations_list: {
    input: z.object({ projectId: z.string() }),
    output: z.array(automation),
  },
} as const;

// The bundled thread list's preferences; only the quick actions its rows show.
export const threadListContract = {
  listPreferences: {
    input: z.null(),
    output: z.looseObject({
      preferences: z.looseObject({ rowActions: z.array(z.string()).optional() }),
    }),
  },
} as const;

const automationRef = z.object({ projectId: z.string(), automationId: z.string() });

/** The bundled Automations plugin's write methods this plugin calls from schedule rows. */
export const automationActionsContract = {
  automations_pause: { input: automationRef, output: z.looseObject({}) },
  automations_resume: { input: automationRef, output: z.looseObject({}) },
} as const;
