---
title: connect my coding agent to PipeTooling
category: Office
roles: dev
keywords: mcp, dev mcp, dev-mcp, account, login, attach a login, invite, sign-in email, password reset, forgot password, signed in, get a teammate online, key, agent, claude, claude code, claude desktop, phone, connector, custom connector, request headers, setup command, terminal, read only, call log, revoke, copy, copy key, lost key, new machine, ptd, PT_DEV_MCP_TOKEN, mcp.clicktooling.com, cost batch, hr entry, plan, apply, revert, dry run
---
Your coding agent can get a read-only door into PipeTooling. It sees exactly what your own sign-in sees.

The one sentence: open **Settings → Your account**, find *Dev MCP keys* and press {{button:blue|Issue a key}}. MCP is the connection a coding agent uses to reach an app.

## What the agent gets

The agent connects to `https://mcp.clicktooling.com/dev` and reads **as you**. It sees the same rows, the same role checks, nothing more. It can search the app's tables and database functions by name, read rows, and call any read function. It cannot write through any of those. The database itself refuses, whatever the agent asks for. Token, hash and password columns come back redacted, that is blanked out. Every call is logged with your name.

The agent changes data only through named doors. Each is a plan, then an apply. Two came first. One is **move job cost** as a batch. You plan, then apply, then revert if wrong. The other is **file an HR entry**. You plan, then apply, with you named as the author. More doors came later. The agent can set up a job, change it and bill it. The agent can file evidence and documents on an HR file or a legal matter. A teammate's account is a door too. See [Get a teammate online with the seat](#get-a-teammate-online-with-the-seat). Each starts with a dry run, a rehearsal that changes nothing. The agent has to read the dry run back to you. The apply only goes through when the dry run still says the same thing. Anything else that changes data still happens in the app.

## Set it up once per machine — in plain words

You do not need to know what a terminal is. There are three steps, and the card walks you through them.

1. Type which machine the key is for, like *Robert's MacBook*. Press {{button:blue|Issue a key}}. The key is shown with its buttons.
2. Press {{button:blue|Copy setup command}}. Open **Terminal**: press ⌘ and Space together, type *Terminal*, press Return. A plain window opens. Paste with ⌘ V and press Return. It answers *Saved. Now quit Claude Code and open it again.*
3. Quit Claude Code with ⌘ Q and open it again in the PipeTooling folder. In a new chat type *call whoami on dev-mcp*. It answers with your name. Done.

:::example What the setup command did
It wrote your key into two files on your Mac and nothing else. One is your shell profile, which Terminal reads. The other is Claude Code's own settings file, which every Claude Code session reads when it starts, in the app or in a terminal. The key never goes in the repo or in a chat. If it says *command not found* or nothing at all, you are not in Terminal — close the window and try step 2 again.
:::

Already know your way around a shell? {{button:gray|Copy shell line}} gives you the bare `export` line for `~/.zshrc` instead. The desktop app does not read that file, so a session it starts has no key. Use the setup command for the app.

## From claude.ai, Claude Desktop or your phone

No Terminal at all, **if** your Claude account shows a *Request headers* section when adding a connector. Anthropic is rolling it out. Some accounts do not have it yet.

1. On claude.ai go to **Customize → Connectors → Add custom connector**. Name it *PipeTooling*. The address is `https://mcp.clicktooling.com/dev`.
2. Choose **No sign-in**. Under **Request headers** pick `authorization`. Paste what {{button:gray|Copy header value}} on the card copied. That is the word *Bearer*, a space, and your key. Press Add.
3. In any chat, open the ＋ menu, find *Connectors*, and switch PipeTooling on. The same connector shows up in Claude Desktop and on your phone.

If there is no *Request headers* section, use the Terminal steps above. The address and the key are the same either way.

:::example One key per machine
Lost a laptop, or done with a borrowed one? {{button:gray|Revoke}} that label and only that machine is cut off. A key also stops working by itself the moment its owner is no longer an active dev.
:::

## Copy a key again

Set up a second tool on the same machine, or lost the setup line? You can copy a live key again from the card.

:::steps

1. Find the key's row under *Dev MCP keys*. Press {{button:gray|Copy}}.
2. A box asks *Copy "Robert's MacBook"?*. Press {{button:blue|Copy}}.
3. The key goes on the clipboard and shows with the same buttons as a new key. Use {{button:blue|Copy setup command}} or {{button:gray|Copy header value}} as above.

:::

Every copy is logged with your name, in the same log as the key's calls. The row shows when the key was last copied.

:::example A key that says *cannot be copied*
Keys issued before 2026-10-26 were never kept, only checked. Press {{button:blue|Issue a key}} for a new one, set the machine up with it, then {{button:gray|Revoke}} the old one.
:::

:::example No clipboard here
Some browsers do not let a page copy. The card then selects the text under the buttons. Press ⌘ C to copy it.
:::

## Get a teammate online with the seat

A session at the seat can make a teammate's account and stay with them until they sign in. It uses the same doors as People → Users and the person desk. Each step is a plan first, then an apply. Read the plan back before you apply it.

:::steps

1. Ask your agent to call `get_login_state` with the person's name or email. It says where they stand and names the next press.
2. No account yet? Ask for `plan_account` with the name, the kind and the email. The plan shows the invite that would go. Apply it and the invite email goes.
3. On the roster with no login? Ask for `plan_login`. Apply it and the sign-in email goes to the address on the row.
4. Call `get_login_state` again a few minutes later. It says whether the link was opened and whether they have signed in.

:::

:::example The words you will hear
*The email went 3 minutes ago, not opened yet.* Ask them to look for the mail from the company address. *Signed in once, 10:14.* They are in. Nothing more is owed.
:::

Typed the name wrong? Ask for `plan_account` with the person and the right name. The roster row and the pay rows follow the new name. The seat refuses a name another live row already carries.

Locked out? Ask for `plan_password_reset`. The app's own Forgot password email goes. One send per address per ten minutes. You can dictate a password instead. The seat never prints it back and never writes it to the log.

:::example What the seat will not do here
It never resets your own password. It never touches a sample, a twin or an archived teammate. A returner comes back from Bring back on their desk, never as a second row.
:::

## What it is not

It is not the robots' connector. That one is `…/twin`, with its own keys under Settings → System → Digital twins. And it is not a way around the app. Beyond its named doors, anything that changes data still happens in the app. Or it goes through the two agent database roles.
