import { definePluginApp, type ComposerSendMenuItem, type PluginComposerApi } from '@get-bb/plugin-sdk/app';
import type { ChildRequest, Notifications } from './logic';
import { PLUGIN_ID, handoffSource } from './logic';

// The host can only disable send-menu rows, not hide them. Our rows carry their
// description as aria-description, so hide them while disabled (outside handoff).
const DESCRIPTION = 'Hand off as a child';
const css = `[role="menuitem"][data-disabled][aria-description^="${DESCRIPTION}"] { display: none !important; }`;

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
  app.contentScripts.register({
    id: 'hide-disabled-rows',
    mount() {
      const style = document.createElement('style');
      style.dataset.bbPlugin = PLUGIN_ID;
      style.textContent = css;
      document.head.append(style);
      return () => style.remove();
    },
  });
  app.composer.customize({
    id: 'handoff-child',
    scopes: ['thread'],
    sendMenu: [
      item('child-notify', 'New child thread', `${DESCRIPTION}; the parent is notified when it finishes`, 'auto'),
      item('child-quiet', 'New child thread (no notifications)', `${DESCRIPTION} without waking the parent`, 'off'),
    ],
  });
});
