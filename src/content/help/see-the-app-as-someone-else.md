---
title: see the app as a role or as a person
category: Getting Started
roles: dev
keywords: view as, imitate, impersonate, login as, sample account, see what an assistant sees, role, exit, back to my account, active accounts, settings
order: 42
---
When you want to know what an assistant, an estimator or a helper actually sees on a page, look through their eyes: **View as** signs you in as that account for real — the same row security, the same switches — and lands you on Settings, where you opened it; from there, go to the page you want to check.

## Open the door

Open Settings: **View as…** is the first chip under the search box at the top of the list, on every tab (devs only). `/settings#view-as` opens it straight from the address bar. Two lists:

- **Roles** — one line per role, each backed by its **sample account** (*Sample assistant*, *Sample estimator*, …). The chips beside a role are the switches its sample carries: {{chip:gray|training mode}} {{chip:gray|Hiring}} {{chip:gray|estimator prospects}}. Pick a role and you are that sample.
- **People** — every active person, searchable by name, email or role. Pick one and you are them. (Never a dev: the login door refuses.)

Then go to the page you wanted to check. If that role cannot open it, the app sends them where it always sends them — which is itself the answer to "can they see this?".

## Come back

The amber {{button:gray|Exit (Sample assistant)}} in the header returns you to your own account **and to the page you left**. Settings → *Back to my account* does the same.

## Sample accounts

They live under Settings → System → **Digital twins & samples**, hidden from every roster, picker, Person rail and notification the way digital twins are — fixtures, never people, so they never get a roster row or pay. {{button:gray|Create the missing samples}} makes one per role that has none; {{button:gray|Manage accounts…}} beside it sets a sample's switches like anyone's — turn on Hiring for *Sample assistant*, then View as it, and the board shows exactly what an assistant with that switch gets.

They are not read-only: a sample can press a button, save a note or advance a candidate, and that write is stamped with the sample's own name. Turn on **training mode** on a sample if you want a look-only one.

:::example Does an assistant see the Hiring pill?
Settings → View as… → **Assistant**. You are *Sample assistant*; open Prospects: no Hiring pill, because the sample has no Hiring switch. Exit. Active accounts → tick Hiring on *Sample assistant*. View as → Assistant again, back to Prospects: the pill is there.
:::

The older **Imitate** buttons on People → Users and the person desk still work; since v2.3606 they land on the page you were on too.
