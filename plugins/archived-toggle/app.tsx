import { definePluginApp } from '@get-bb/plugin-sdk/app';
import { toast } from 'sonner';
import { toggleArchived } from './lifecycles';

export default definePluginApp(app => {
  app.experimental_sidebarFooter.register({
    kind: 'action',
    id: 'toggle-archived',
    label: 'Show or hide archived threads',
    icon: 'Archive',
    async onActivate() {
      try {
        await toggleArchived();
      } catch (error) {
        toast.error(error instanceof Error ? error.message : 'Could not toggle archived threads');
      }
    },
  });
});
