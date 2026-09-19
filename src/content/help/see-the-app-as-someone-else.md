---
title: see the app as a role or as a person
category: Getting Started
roles: dev
keywords: view as, imitate, impersonate, login as, sample account, see what an assistant sees, role, exit, back to my account, active accounts
order: 42
---
When you want to know what an assistant, an estimator or a helper actually sees on a page, look through their eyes: **View as** signs you in as that account for real — the same row security, the same switches — and lands you on the page you were on.

## Open the door

From any page, open the gear menu and pick **View as…** (devs only). Two lists:

- **Roles** — one line per role, each backed by its **sample account** (*Sample assistant*, *Sample estimator*, …). The chips beside a role are the switches its sample carries: {{chip:gray|training mode}} {{chip:gray|Hiring}} {{chip:gray|estimator prospects}}. Pick a role and you are that sample, on this page.
- **People** — every active person, searchable by name, email or role. Pick one and you are them, on this page. (Never a dev: the login door refuses.)

If that role cannot open the page you were on, the app sends them where it always sends them — which is itself the answer to "can they see this?".

## Come back

The amber {{button:gray|Exit (Sample assistant)}} in the header returns you to your own account **and to the page you left**. Settings → *Back to my account* does the same.

## Sample accounts

They live under Settings → Active accounts → **Sample accounts**, hidden from every roster, picker, Person rail and notification the way digital twins are. {{button:gray|Create the missing samples}} makes one per role that has none. Set a sample's switches there like anyone's — turn on Hiring for *Sample assistant*, then View as it, and the board shows exactly what an assistant with that switch gets.

They are not read-only: a sample can press a button, save a note or advance a candidate, and that write is stamped with the sample's own name. Turn on **training mode** on a sample if you want a look-only one.

:::example Does an assistant see the Hiring pill?
On Prospects, gear → View as… → **Assistant**. You land on Prospects as *Sample assistant*: no Hiring pill, because the sample has no Hiring switch. Exit. Active accounts → tick Hiring on *Sample assistant*. View as → Assistant again: the pill is there.
:::

The older **Imitate** buttons on People → Users and the person desk still work; since v2.3606 they land on the page you were on too.
