---
title: connect my coding agent to PipeTooling
category: Office
roles: dev
keywords: mcp, dev mcp, dev-mcp, key, agent, claude code, connector, read only, call log, revoke, ptd, PT_DEV_MCP_TOKEN, mcp.clicktooling.com
---
The one sentence: **Settings → System → Digital twins → *Dev MCP keys* → {{button:purple|Issue a key}} gives your coding agent a read-only door into PipeTooling that sees exactly what your own sign-in sees.**

## What the agent gets

The agent connects to `https://mcp.clicktooling.com/dev` and reads **as you**: the same rows, the same role checks, nothing more. It can search the app's tables and database functions by name, read rows, and call any read function. It cannot write — the database itself refuses, whatever the agent asks for — and token, hash and password columns come back redacted. Every call is logged with your name.

## Set it up once per machine

1. Type which machine the key is for — that is its label, and how you will revoke it later — and press {{button:purple|Issue a key}}.
2. The key is shown **once**. Press {{button:purple|Copy shell line}} and paste the line into your shell profile (`~/.zshrc`). The key lives in your environment; it never goes in the repo or in a chat.
3. Open a new terminal and start Claude Code in the repo. The `dev-mcp` connector is already in `.mcp.json`; ask the agent to *call whoami on dev-mcp* and it answers with your name.

:::example One key per machine
Lost a laptop, or done with a borrowed one? {{button:gray|Revoke}} that label and only that machine is cut off. A key also stops working by itself the moment its owner is no longer an active dev.
:::

## What it is not

It is not the robots' connector — that is `…/twin`, with its own keys on the same page. And it is not a way around the app: anything that changes data still happens in the app, or through the two agent database roles.
