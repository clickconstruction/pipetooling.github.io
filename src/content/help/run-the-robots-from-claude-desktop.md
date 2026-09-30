---
title: run the robot estimator from the Claude app
category: Bids & Estimating
roles: dev
keywords: robot, twin, shadow, backlog, needs you, robots have work waiting, claude, claude code, code tab, code session, claude desktop, claude.ai, chat, phone, kickoff, connector, custom connector, request headers, header value, mcp, key, setup command, set up on this mac, setup code, console, queue, batch, coverage, plans, attach, drag, approve, always allow, two at once, incognito, memory
---
The one sentence: **Bids → 🤖 Robots → Console has a {{button:blue|Copy Code kickoff}} button; paste what it copies into a new session on the Claude app's Code tab and the robot works the shadow queue one bid at a time, reading each plan set itself.**

## Which way to run it

There are three, and the Console's *Run the robots* card lists them in this order.

- **A Code session** — the Code tab in the Claude app on a Mac. The robot has a place to put files, so it pulls every plan sheet through the connector and reads it. You paste once and come back to a report. Use this one.
- **A chat** — claude.ai, the phone, or a Mac without the Code tab. It works, but a chat cannot open the plan pages, so the robot stops at every bid and asks you to drag the plan PDF in, and Claude asks you to approve each robot tool the first time it is used.
- **The hourly routine** — a Claude Code routine on a repo checkout that keeps coverage up by itself on weekdays. {{button:gray|Copy handoff prompt}} on the same card hands it to someone.

## Set it up once

One command, and you never see the key. The same setup serves the Code tab and chats.

1. On **Bids → 🤖 Robots → Console**, step 1 of the *From Claude Code* column, press {{button:purple|Set up on this Mac}} (the same button is on the robot's row at Settings → Digital twins). Type whose Mac it is — that becomes the key's label, so it can be revoked on its own later — and press {{button:purple|Make my setup command}}.
2. {{button:purple|Copy the command}}. It carries a one-time code that is good for ten minutes and one use.
3. Open Terminal (⌘ Space, type *Terminal*, Return), paste, press Return. The command trades the code for a fresh key on the server and writes the key straight into Claude's connector config, then quits Claude and reopens it so the connector loads, and puts the robot's kickoff on your clipboard. Anything running in Claude stops when it quits, so finish or pause that first. If it says Node is missing, install Node 18 or newer from nodejs.org and run it again.
4. In Claude, open the **Code** tab, start a new session and paste. The robot reads its brief and says the connector answered.

:::example Why a code instead of a key
The key is what lets a machine act as the robot. Handing it to a person to paste means it sits in a clipboard, a chat, or a shell history somewhere. The code is worth one key for ten minutes; the command redeems it and the key goes from the server straight into the config file. Nobody ever reads it.
:::

The long way — another harness, or a Mac where the short way failed — is a key you can see: **Settings → System → Digital twins → Fleet → Twin Estimator 1 → {{button:blue|Issue key}}**, then {{button:gray|Copy Desktop setup command}} on the card that shows it (on the Console it is {{button:gray|Key-based command}}); paste into Terminal and paste the key when the silent prompt asks; quit and reopen Claude yourself. Either way, a session with no twin-mcp tools at all means the connector didn't load — look under Claude's Settings → Developer for `twin-mcp` and its error. A 401 means the key is wrong or revoked; run the setup again.

## Run a batch

1. Open **Bids → 🤖 Robots → Console** and press {{button:blue|Copy Code kickoff}} (step 2 of the *Run the robots* card). {{button:gray|Preview the Code kickoff}} under it shows exactly what goes to the clipboard.
2. In Claude, open the **Code** tab, start a **new session** and paste. The kickoff opens by telling the session to run it, so it starts without a question. If it does ask what to do with the text, answer *run it here as the robot*.
3. The robot scores existing shadows, reads its guides, then calls the dispatcher for the oldest uncovered bid, human requests first. At the plans stage it fetches the sheets itself, a few pages at a time, reads them, and carries on: substrate, takeoff, counts, prices, lock, audit questions, report. Nothing to attach.
4. It claims the next bid only after the current one is locked and reported, and stops after three bids in one session. Paste the kickoff into a fresh session for the rest. *done: true* from the dispatcher means the live board is fully covered.

:::example Two at once
Each session claims its own bid, and the dispatcher never hands two sessions the same one, so a second Code session can run beside the first: paste the kickoff again. Keep it to two — the robot's sign-ins are limited to six a minute. A session that finds an open bid another session touched in the last hour leaves it alone and says so.
:::

:::example What the session will not touch
A Code session often sits in a checkout of the app with other connectors attached. The kickoff fences the robot to its own connector: it reads no repo files, no release notes and no dev connector, because any of them could show it a human's number, and it writes nothing into the checkout. The plan sheets it downloads stay in the session's temp folder.
:::

## What you see on the board

Each shell the robot locks shows up on the Bid Board's robot icon as a lock badge on the human bid it shadows, and as a sealed row on the Robot Board. Nobody sees the sealed number until the estimator sends; the score lands then. The robot's sign-ins, heartbeats and reports scroll past under *Recent runs* on the Console, and anything the machine blocked it on lands under *Operator questions* there.

## From a chat — claude.ai, the phone, or a Mac without Code

The chat has its own kickoff: {{button:gray|Copy chat kickoff}} in the *From a Claude chat* column. Paste it into a **new incognito chat** — incognito so nothing from an earlier batch is recalled into this one. Two things are different from a Code session:

- **You attach the plans.** At the plans stage the robot names the shell and the plans link and stops. Open the link and drag the PDF into the chat, and it continues.
- **Claude asks before each robot tool.** The first time the robot uses a tool, Claude asks you to allow it. Choose *Always allow*: that is about twenty-five approvals on a first batch, and none of them again after.

On a Mac the setup above already covers chats. With no Mac — claude.ai or the phone — the connector is added by hand, if your Claude account shows a *Request headers* section when adding a connector (Anthropic is rolling it out; some accounts do not have it yet). The card that shows a fresh key walks through it:

1. Issue the key as above. On claude.ai go to **Customize → Connectors → Add custom connector**. Name it after the robot — *Twin Estimator 1* — and the address is `https://mcp.clicktooling.com/twin`.
2. Choose **No sign-in**. Under **Request headers** pick `authorization` and paste what {{button:purple|Copy header value}} on the card copied — the word *Bearer*, a space, and the key. Press Add.
3. Start a **new incognito chat**, switch the connector on under the ＋ menu, and paste the chat kickoff.

:::example One connector per robot
The connector holds one key, and a key is one robot's seat. A second robot — the pricing twin — is a second connector with its own key and its own kickoff. Revoking the key's label on the Digital twins page cuts that connector off wherever it was added.
:::

## Know when there is work

You do not have to check the Console to know. When bids want a shadow or price matrices are queued, your Dashboard's **Needs you** card carries one line — {{chip:blue|Robots}} *Robots have work waiting · 4 bids want a shadow (oldest asked 3 days ago) · 2 price matrices queued (oldest 5 hours)* — naming the first of each. It turns {{chip:yellow|amber}} only when something is stuck: a matrix the robot went quiet on for over an hour, or a bid request older than a week. {{button:blue|Open the Console}} lands here. Snooze it for a day or dismiss it until the count rises; it disappears on its own when the robots are caught up.

## What it will not do

The prompt carries the owner's rules: never send anything to a customer, never mark a bid sent, never edit a human's bid, never touch a bid that is not its ZZ shell, never invent a number without plans, and never ask for, read or repeat the key. Anything the permission layer blocks is stamped on the ledger and asked as a question, not worked around.

A bid whose plans it can't read is **parked**, not abandoned: the robot files a plans ask on that bid (the amber icon on the Bid Board), leaves its shell open, and moves to the next bid. When someone taps {{button:blue|★ Attached — rerun}}, the next batch hands that shell back first. Questions about the job go to the estimator's Standing rulings; questions about the robot's own machine go to the operator on the Console.

To cut a machine off, revoke its key label on the Digital twins page.
