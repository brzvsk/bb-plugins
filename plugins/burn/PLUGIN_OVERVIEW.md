## What you get

- **A cost chip under the prompt box**, beside the context circle. It shows the thread's total, for example `$4.27`. Click it for a card with the thread's total tokens, where the money and tokens went by kind (input, cache write, cache read and output), its native subagent spend, a bar for every model call, the models used, and the total with the thread's child threads, such as minions. From the card you can set a budget, open the Burn tab or copy a summary. On a phone, a flame in the thread header opens the same card while the prompt box is collapsed.
- **A Burn tab in the side panel** that lists every prompt with its cost, newest or costliest first, and every child thread with its model, calls and cost.
- **A Burn page in bb's navigation** with spend across all threads for today, the last 7 days or the last 30 days, or any earlier day, 7 days or 30 days, for every project or one. It ranks by cost, tokens or calls, and shows spend per day by model, the token mix against what it cost, call times, the busiest hours, the costliest threads, a table of models, and spend by project and by harness.
- **A Cost entry in every thread menu**, and a red flame in the sidebar on threads over their budget.

## Budgets

Set a budget for one thread from the chip, the thread menu or the Burn tab, or set one budget for every thread in the plugin settings. Burn sends a notification at 80% and at 100% of a thread's budget, and once a day when all threads together pass the daily budget you set. It never stops a thread unless you turn on **Stop a thread at its budget**, which is off by default. Another optional notification flags a prompt that cost at least three times the thread's median and at least $0.50.

## Where the numbers come from

Burn counts every thread, whatever harness runs it. For pi threads it reads the session logs that bb's pi bridge keeps on each machine, where pi already records the cost of every call. For OpenCode threads it reads opencode's own database on the same machine, where every assistant message records its tokens and cost, including the calls of subagents that the task tool starts in child sessions. DeepSeek's peak hours (weekdays 01:00-04:00 and 06:00-10:00 UTC) are priced at their doubled rate, since opencode records the off-peak price; Chinese public holidays are not modelled. For Claude Code it reads the transcripts on the machine that runs the thread, including subagent and workflow files, and prices their tokens itself; a turn's transcript replaces the bb events that omit it. For Codex it reads the token usage that bb records after each call or turn, keeping a native child's counter apart from its parent's. For other harnesses it reads the token usage that bb records after each call or turn, and keeps its own copy, because bb deletes older usage events. When a harness reports no cost, Burn prices its tokens at list price and marks the amount as an estimate, such as `~$1.23`. A model with no known price shows tokens instead of dollars.

## The pi extension (optional)

The same repository ships a pi extension, installed separately with `pi install git:github.com/kalindudc/burn`. It adds a cost pill to pi's status line and a `/burn` overlay in the terminal, with or without bb. In a bb thread it also stops a run at its budget from inside pi, which is quicker than stopping it through bb. The bb plugin works without it.

## Requirements and limits

- bb 0.46 or newer. No account and no outside service: Burn reads only what bb and pi already record.
- Dollar figures are list prices unless you set a discount in Burn's settings, such as a contract rate.
- Claude Code threads update once per turn, count their subagents and workflow files from the execution host's transcripts, and are never stopped at their budget, though budget alerts still fire. A deleted transcript or an unavailable host leaves the last saved report, marked partial.
- Call times are recorded for pi and OpenCode threads; failed calls only when the harness records that the call failed.
- A harness that sends bb no usage, and whose own records Burn does not read, shows nothing.

Documentation and source: https://github.com/kalindudc/burn

Based on Burn by [Kalindu De Costa](https://github.com/kalindudc); maintained in [brzvsk/bb-plugins](https://github.com/brzvsk/bb-plugins/tree/main/plugins/burn).
