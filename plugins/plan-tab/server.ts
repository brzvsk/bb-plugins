import { defineRpcContract, type BbPluginApi } from '@get-bb/plugin-sdk';
import { z } from 'zod';

export const rpcContract = defineRpcContract({
  host: {
    input: z.object({ threadId: z.string().min(1).max(200) }),
    output: z.object({ hostId: z.string().nullable() }),
  },
});

export default function plugin(bb: BbPluginApi) {
  bb.rpc.register(rpcContract, {
    // The plan file lives on the machine that runs the thread's environment.
    async host({ threadId }) {
      const thread = await bb.sdk.threads.get({ threadId });
      if (!thread.environmentId) return { hostId: null };
      const environment = await bb.sdk.environments.get({ environmentId: thread.environmentId });
      return { hostId: environment.hostId ?? null };
    },
  });
}
