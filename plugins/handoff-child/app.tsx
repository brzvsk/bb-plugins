import { definePluginApp, type ComposerSendMenuItem, type PluginComposerApi } from '@get-bb/plugin-sdk/app';
import type { ChildRequest, Notifications } from './logic';
import { handoffSource } from './logic';

const sourceOf = (composer: PluginComposerApi) => handoffSource(composer.scope, composer.draft.mentions);

function item(id: string, label: string, description: string, notifications: Notifications): ComposerSendMenuItem {
  return {
    id,
    label,
    description,
    icon: 'GitBranch',
    disabled: composer => sourceOf(composer) === null,
    async run({ composer }) {
      const sourceThreadId = sourceOf(composer);
      if (!sourceThreadId) return;
      const data: ChildRequest = { kind: 'handoff-child', sourceThreadId, notifications };
      await composer.submit({ experimental_data: data });
    },
  };
}

export default definePluginApp(app => {
  app.composer.customize({
    id: 'handoff-child',
    scopes: ['thread'],
    sendMenu: [
      item('child-notify', 'New child thread', 'Hand off as a child; the parent is notified when it finishes', 'auto'),
      item('child-quiet', 'New child thread (no notifications)', 'Hand off as a child without waking the parent', 'off'),
    ],
  });
});
