# Pinned Project Line

Shows each pinned thread's project name on a second, smaller line in the BB sidebar, so pinned threads from different projects stay distinguishable. Rows grow by 12px (about 1.4× the default row height); threads inside project groups are unchanged.

Project names come from BB itself, so an emoji in the project name (`bb project update <id> --name "🎬 creators_crm"`) shows up in the line too. No settings, network services or credentials. Disabling the plugin removes every added line.

Requires BB 0.46.1+. Uses BB sidebar DOM markup; future layout changes may require an update.

Build: `npm ci --include=dev --ignore-scripts`, `npm run typecheck`, `npm test`, `npm run build`. Install: `bb plugin install . --yes`.
