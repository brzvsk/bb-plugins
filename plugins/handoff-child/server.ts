import type { BbPluginApi } from '@get-bb/plugin-sdk';
import { readRequest, shouldAdopt } from './logic';

export default async function handoffChildPlugin(bb: BbPluginApi) {
  bb.experimental_hooks.on('message.dispatch', ctx => {
    const request = readRequest(ctx.experimental_submission);
    if (request && shouldAdopt(ctx.thread, request)) {
      // Linking never blocks the send: the thread starts either way.
      void bb.sdk.threads
        .update({
          threadId: ctx.thread.id,
          parentThreadId: request.sourceThreadId,
          parentNotifications: request.notifications,
        })
        .catch(error => console.error(`handoff-child: could not link ${ctx.thread.id}`, error));
    }
    return { action: 'proceed' };
  });
}
