---
title: run the robot estimator from Claude Desktop
category: Bids & Estimating
roles: dev
keywords: robot, twin, shadow, claude desktop, kickoff, connector, mcp, key, setup command, set up on this mac, setup code, console, queue, batch, coverage, incognito, memory
---
The one sentence: **Bids → 🤖 Robots → Console has a {{button:blue|Copy Desktop kickoff}} button; paste what it copies into a new Claude Desktop chat and the robot works the shadow queue one bid at a time, with you attaching the plans when it asks.**

## When to use it

The hourly shadow batch runs from Claude Code on the operator's machine (the handoff prompt is on the same Console lens, under {{button:gray|Copy handoff prompt}}). The Desktop kickoff is for a machine with no repo checkout and no terminal: a laptop with Claude Desktop, Node, and a robot key. It is slower per bid, because a person feeds it the plan PDFs, but it needs nothing else.

## Set it up once

The short way is one command, and you never see the key.

1. On **Bids → 🤖 Robots → Console**, step 1 of the *From Claude Desktop* column, press {{button:purple|Set up on this Mac}} (the same button is on the robot's row at Settings → Digital twins). Type whose Mac it is — that becomes the key's label, so it can be revoked on its own later — and press {{button:purple|Make my setup command}}.
2. {{button:purple|Copy the command}}. It carries a one-time code that is good for ten minutes and one use.
3. Open Terminal (⌘ Space, type *Terminal*, Return), paste, press Return. The command trades the code for a fresh key on the server and writes the key straight into Claude Desktop's connector config, then quits Claude Desktop and reopens it so the connector loads, and puts the robot's kickoff on your clipboard. If it says Node is missing, install Node 18 or newer from nodejs.org and run it again.
4. In Claude Desktop, start a **new incognito chat** and paste. The robot reads its brief and says the connector answered.

:::example Why a code instead of a key
The key is what lets a machine act as the robot. Handing it to a person to paste means it sits in a clipboard, a chat, or a shell history somewhere. The code is worth one key for ten minutes; the command redeems it and the key goes from the server straight into the config file. Nobody ever reads it.
:::

The long way — for a Claude Code operator, another harness, or a Mac where the short way failed — is a key you can see: **Settings → System → Digital twins → Fleet → Twin Estimator 1 → {{button:blue|Issue key}}**, then {{button:blue|Copy Desktop setup command}} on the card that shows it (on the Console it is {{button:gray|Key-based command}}); paste into Terminal and paste the key when the silent prompt asks; quit and reopen Claude Desktop yourself. Either way, *call get_brief on twin-mcp* in a new chat should return the brief. No twin-mcp tools at all means the connector didn't load — look under Settings → Developer for `twin-mcp` and its error. A 401 means the key is wrong or revoked; run the setup again.

## Run a batch

1. Open **Bids → 🤖 Robots → Console** and press {{button:blue|Copy Desktop kickoff}} (step 2 of the *Run the robots* card). {{button:gray|Preview the kickoff}} under it shows exactly what goes to the clipboard.
2. Start a **new incognito** Claude Desktop conversation and paste — incognito so nothing from an earlier batch is recalled into this one. The robot scores existing shadows, reads its guides, then calls the dispatcher for the oldest uncovered bid, human requests first.
3. When it reaches the plans stage it names the shell and the plans link and stops. Open the link, drag the PDF into the chat, and it continues: substrate, takeoff, counts, prices, lock, audit questions, report.
4. It claims the next bid only after the current one is locked and reported, and stops after three bids in one chat. Paste the kickoff into a fresh chat for the rest. *done: true* from the dispatcher means the live board is fully covered.

:::example What you see on the board
Each shell the robot locks shows up on the Bid Board's robot icon as a lock badge on the human bid it shadows, and as a sealed row on the Robot Board. Nobody sees the sealed number until the estimator sends; the score lands then. The robot's sign-ins, heartbeats and reports scroll past under *Recent runs* on the Console, and anything the machine blocked it on lands under *Operator questions* there.
:::

## What it will not do

The prompt carries the owner's rules: never send anything to a customer, never mark a bid sent, never edit a human's bid, never touch a bid that is not its ZZ shell, never invent a number without plans, and never ask for or repeat the key. Anything the permission layer blocks is stamped on the ledger and asked as a question, not worked around.

A bid whose plans it can't read is **parked**, not abandoned: the robot files a plans ask on that bid (the amber icon on the Bid Board), leaves its shell open, and moves to the next bid. When someone taps {{button:blue|★ Attached — rerun}}, the next batch hands that shell back first. Questions about the job go to the estimator's Standing rulings; questions about the robot's own machine go to the operator on the Console.

To cut a machine off, revoke its key label on the Digital twins page.
