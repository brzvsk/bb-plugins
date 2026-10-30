# Context Card Extras

Adds two things to BB's **thread context card** (Settings → Experiments → Thread context card):

- **Branch**: the thread's current branch, with how far it is ahead of or behind its merge base (e.g. `4 ahead of main`). Detached checkouts show the short commit.
- **Automations**: every automation that re-prompts this thread, with its state (`Next Oct 31, 10:00 AM`, `Paused`, `Running`, `Not scheduled`). Click one to open it in Automations (the SDK has no cross-plugin navigation, so this pushes the Automations page route; a BB routing change could break the click, not the rows).

Data comes from BB's bundled Git plugin (`bb--git` `status`) and the Automations plugin (`automations_list`); nothing is stored. Rows appear only in panes whose thread context kind is `card`; the Info tab is unchanged.

Requires BB 0.48.1 or later. Uses experimental SDK slots (`experimental_threadContextCardRow`, `experimental_threadContextCardSection`), so a future BB may need an update.
