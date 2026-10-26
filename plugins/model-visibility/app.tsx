import { definePluginApp } from '@get-bb/plugin-sdk/app';
import './app.css';
import { mountModelVisibility } from './content';
import { ModelVisibilitySettings } from './settings';

export default definePluginApp((app) => {
  app.slots.settingsSection({
    id: 'model-visibility',
    component: ModelVisibilitySettings,
  });

  app.contentScripts.register({
    id: 'model-visibility-menu',
    mount({ pluginId, signal }) {
      return mountModelVisibility({ pluginId, signal });
    },
  });
});
