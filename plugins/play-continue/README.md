# Play Continue

Port of [dsh-plugins/play-continue](https://github.com/brzvsk/dsh-plugins/tree/main/play-continue) to BB.

## Stop shortcut

Press Escape twice within 400 ms to press BB's native **Stop run** button in the
visible thread composer. The first press replaces the Stop icon with `Esc` for
400 ms; a timeout or the second press restores it. Single presses, held-key
repeats and modified presses do not stop. The shortcut yields to menus, dialogs,
IME composition and editable fields outside the composer. With several composers
on screen, focus must be in the target one. No automatic restart follows.

## Play

After the latest turn was stopped (`interrupted`), failed (`failed`), or left
open by a crash (a `turn/started` with no `turn/completed` on an idle thread), a
Play button replaces the disabled Send button. It appears only for an idle or
errored thread with an empty composer, no attachments and no queued messages.
Typing restores Send; running threads keep the native Stop.

Clicking re-checks the thread, then submits a visible continuation message
through the composer exactly as Enter would:

> Continue the unfinished task from where it stopped. Check the current state
> before repeating any action whose outcome is uncertain.

This starts a new turn; it is not a resumed provider stream or a replay of the
original prompt.

## Limits

- Mounts as a hidden composer action, so it follows BB's action rules: thread
  composers in the expanded layout only, and only while the plugin is among the
  first three plugins with composer actions (later ones move to an overflow menu
  and are not mounted until it opens).
- Send has no replacement slot. The plugin hides only the disabled native button
  and inserts its own button with the same classes, restoring the native one on
  any state change or teardown.

## Install

```sh
bb plugin install /path/to/bb-plugins --plugin play-continue --yes
```

## Development

```sh
npm ci
npm test
npm run typecheck
npm run build
```
