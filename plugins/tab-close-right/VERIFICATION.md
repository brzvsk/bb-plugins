# Packaging verification

Prepared on 2026-10-18 for BB 0.46.1 / Plugin SDK 0.6.49.

- Original app.tsx and server.ts preserved; no behavioral changes.
- Fresh npm dependency installation and TypeScript check passed.
- BB plugin build passed.
- A separate temporary source copy, without node_modules or dist, passed npm ci --omit=dev --omit=optional --ignore-scripts and bb plugin build. This matches the dependency omission used for Git installation.
- The same clean copy passed npm ci --include=dev --ignore-scripts and npm run typecheck.
- npm pack produced a local archive containing the required frontend/backend bundles and metadata, manifest, icon, license and documentation.
- Archive inspected: no symlinks, node_modules, source maps, local user paths or Focus references.

The unchanged UI was previously verified in running BB: active-tab visibility, inactive hover visibility, persistent icon, constant tab width and close behavior. A separate fresh BB server installation was not launched during packaging. The installed local plugin was not switched to this candidate.

No remote, tag, marketplace submission or published release was created. Remaining publication work: choose/create the public repository, capture a marketplace screenshot without private content, verify the marketplace entry against its current schema, then publish an approved tagged commit and submit the listing.
