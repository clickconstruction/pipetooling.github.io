---
title: connect my coding agent to PipeTooling
category: Office
roles: dev
keywords: mcp, dev mcp, dev-mcp, key, agent, claude, claude code, claude desktop, phone, connector, custom connector, request headers, setup command, terminal, read only, call log, revoke, ptd, PT_DEV_MCP_TOKEN, mcp.clicktooling.com
---
The one sentence: **Settings → Your account → *Dev MCP keys* → {{button:blue|Issue a key}} gives your coding agent a read-only door into PipeTooling that sees exactly what your own sign-in sees.**

## What the agent gets

The agent connects to `https://mcp.clicktooling.com/dev` and reads **as you**: the same rows, the same role checks, nothing more. It can search the app's tables and database functions by name, read rows, and call any read function. It cannot write — the database itself refuses, whatever the agent asks for — and token, hash and password columns come back redacted. Every call is logged with your name.

## Set it up once per machine — in plain words

You do not need to know what a terminal is. Three steps, and the card walks you through them.

1. Type which machine the key is for — *Robert's MacBook* — and press {{button:blue|Issue a key}}. The key is shown **once**.
2. Press {{button:blue|Copy setup command}}. Open **Terminal**: press ⌘ and Space together, type *Terminal*, press Return. A plain window opens. Paste (⌘ V) and press Return. It answers *Saved. Now quit Claude Code and open it again.*
3. Quit Claude Code (⌘ Q) and open it again in the PipeTooling folder. In a new chat type *call whoami on dev-mcp*. It answers with your name — done.

:::example What the setup command did
It wrote one line into a settings file on your Mac that Claude Code reads when it starts, and nothing else. The key never goes in the repo or in a chat. If it says *command not found* or nothing at all, you are not in Terminal — close the window and try step 2 again.
:::

If you already know your way around a shell, {{button:gray|Copy shell line}} gives you the bare `export` line for `~/.zshrc` instead.

## From claude.ai, Claude Desktop or your phone

No Terminal at all, **if** your Claude account shows a *Request headers* section when adding a connector (Anthropic is rolling it out; some accounts do not have it yet).

1. On claude.ai go to **Customize → Connectors → Add custom connector**. Name it *PipeTooling*; the address is `https://mcp.clicktooling.com/dev`.
2. Choose **No sign-in**. Under **Request headers** pick `authorization`, and paste what {{button:gray|Copy header value}} on the card copied — it is the word *Bearer*, a space, and your key. Press Add.
3. In any chat, open the ＋ menu, find *Connectors*, and switch PipeTooling on. The same connector shows up in Claude Desktop and on your phone.

If there is no *Request headers* section, use the Terminal steps above. The address and the key are the same either way.

:::example One key per machine
Lost a laptop, or done with a borrowed one? {{button:gray|Revoke}} that label and only that machine is cut off. A key also stops working by itself the moment its owner is no longer an active dev.
:::

## What it is not

It is not the robots' connector — that is `…/twin`, with its own keys under Settings → System → Digital twins. And it is not a way around the app: anything that changes data still happens in the app, or through the two agent database roles.
