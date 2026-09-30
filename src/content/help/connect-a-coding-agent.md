---
title: connect my coding agent to PipeTooling
category: Office
roles: dev
keywords: mcp, dev mcp, dev-mcp, key, agent, claude, claude code, claude desktop, phone, connector, custom connector, request headers, setup command, terminal, read only, call log, revoke, ptd, PT_DEV_MCP_TOKEN, mcp.clicktooling.com, cost batch, hr entry, plan, apply, revert, dry run
---
Your coding agent can get a read-only door into PipeTooling. It sees exactly what your own sign-in sees.

The one sentence: open **Settings → Your account**, find *Dev MCP keys* and press {{button:blue|Issue a key}}. MCP is the connection a coding agent uses to reach an app.

## What the agent gets

The agent connects to `https://mcp.clicktooling.com/dev` and reads **as you**. It sees the same rows, the same role checks, nothing more. It can search the app's tables and database functions by name, read rows, and call any read function. It cannot write through any of those. The database itself refuses, whatever the agent asks for. Token, hash and password columns come back redacted, that is blanked out. Every call is logged with your name.

The agent can change two things. A database agent already could change the same two, through the same audited doors. One is **move job cost** as a batch. You plan, then apply, then revert if wrong. The other is **file an HR entry**. You plan, then apply, with you named as the author. Each starts with a dry run, a rehearsal that changes nothing. The agent has to read the dry run back to you. The apply only goes through when the dry run still says the same thing. Anything else that changes data still happens in the app.

## Set it up once per machine — in plain words

You do not need to know what a terminal is. There are three steps, and the card walks you through them.

1. Type which machine the key is for, like *Robert's MacBook*. Press {{button:blue|Issue a key}}. The key is shown **once**.
2. Press {{button:blue|Copy setup command}}. Open **Terminal**: press ⌘ and Space together, type *Terminal*, press Return. A plain window opens. Paste with ⌘ V and press Return. It answers *Saved. Now quit Claude Code and open it again.*
3. Quit Claude Code with ⌘ Q and open it again in the PipeTooling folder. In a new chat type *call whoami on dev-mcp*. It answers with your name. Done.

:::example What the setup command did
It wrote one line into a settings file on your Mac that Claude Code reads when it starts, and nothing else. The key never goes in the repo or in a chat. If it says *command not found* or nothing at all, you are not in Terminal — close the window and try step 2 again.
:::

Already know your way around a shell? {{button:gray|Copy shell line}} gives you the bare `export` line for `~/.zshrc` instead.

## From claude.ai, Claude Desktop or your phone

No Terminal at all, **if** your Claude account shows a *Request headers* section when adding a connector. Anthropic is rolling it out. Some accounts do not have it yet.

1. On claude.ai go to **Customize → Connectors → Add custom connector**. Name it *PipeTooling*. The address is `https://mcp.clicktooling.com/dev`.
2. Choose **No sign-in**. Under **Request headers** pick `authorization`. Paste what {{button:gray|Copy header value}} on the card copied. That is the word *Bearer*, a space, and your key. Press Add.
3. In any chat, open the ＋ menu, find *Connectors*, and switch PipeTooling on. The same connector shows up in Claude Desktop and on your phone.

If there is no *Request headers* section, use the Terminal steps above. The address and the key are the same either way.

:::example One key per machine
Lost a laptop, or done with a borrowed one? {{button:gray|Revoke}} that label and only that machine is cut off. A key also stops working by itself the moment its owner is no longer an active dev.
:::

## What it is not

It is not the robots' connector. That one is `…/twin`, with its own keys under Settings → System → Digital twins. And it is not a way around the app. Beyond a cost batch and an HR entry, anything that changes data still happens in the app. Or it goes through the two agent database roles.
