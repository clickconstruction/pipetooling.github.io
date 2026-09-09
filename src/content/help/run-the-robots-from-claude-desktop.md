---
title: run the robot estimator from Claude Desktop
category: Bids & Estimating
roles: dev
keywords: robot, twin, shadow, claude desktop, kickoff, connector, mcp, key, queue, batch, coverage
---
The one sentence: **Bids → 🤖 Robots → Queue has a {{button:blue|Copy Desktop kickoff}} button; paste what it copies into a new Claude Desktop chat and the robot works the shadow queue one bid at a time, with you attaching the plans when it asks.**

## When to use it

The hourly shadow batch runs from Claude Code on the operator's machine (the handoff prompt lives at Settings → Digital twins). The Desktop kickoff is for a machine with no repo checkout and no terminal: a laptop with Claude Desktop, Node, and a robot key. It is slower per bid, because a person feeds it the plan PDFs, but it needs nothing else.

## Set it up once

1. Issue a robot key: **Settings → System → Digital twins → Fleet → Twin Estimator 1 → {{button:blue|Issue key}}**, labelled with the person's name. It shows once.
2. In Claude Desktop, **Settings → Developer → Edit Config** and add the connector block from the kickoff (it is inside the copied text, with this project's connector address already filled in). The key goes in that file as an environment value and nowhere else. Quit and reopen Desktop.
3. In a new chat type *call get_brief on twin-mcp*. A brief means the door is open; a 401 means the key is wrong or revoked.

## Run a batch

1. Open **Bids → 🤖 Robots → Queue** and press {{button:blue|Copy Desktop kickoff}}. The tab shows *Copied ✓* for a moment; {{button:gray|Preview the prompt}} under it shows exactly what went to the clipboard.
2. Start a **new** Claude Desktop conversation and paste. The robot scores existing shadows, reads its guides, then calls the dispatcher for the oldest uncovered bid, human requests first.
3. When it reaches the plans stage it names the shell and the plans link and stops. Open the link, drag the PDF into the chat, and it continues: substrate, takeoff, counts, prices, lock, audit questions, report.
4. It claims the next bid only after the current one is locked and reported, and stops after three bids in one chat. Paste the kickoff into a fresh chat for the rest. *done: true* from the dispatcher means the live board is fully covered.

:::example What you see on the board
Each shell the robot locks shows up on the Bid Board's robot icon as a lock badge on the human bid it shadows, and on the Robots → Shadows lens. Nobody sees the sealed number until the estimator sends; the score lands then.
:::

## What it will not do

The prompt carries the owner's rules: never send anything to a customer, never mark a bid sent, never edit a human's bid, never touch a bid that is not its ZZ shell, never invent a number without plans, and never ask for or repeat the key. Anything the permission layer blocks is stamped on the ledger and asked as a question, not worked around.

To cut a machine off, revoke its key label on the Digital twins page.
