---
title: see the app as a role or as a person
category: Getting Started
roles: dev
keywords: view as, imitate, impersonate, login as, sample account, see what an assistant sees, role, exit, back to my account, active accounts, settings
order: 42
---
View as signs you in as another account for real. You then see every page exactly as that person sees it.

You want to know what an assistant, an estimator or a helper actually sees on a page. So you look through their eyes. **View as** signs you in as that account for real. You get the same row security and the same switches. It lands you on Settings, where you opened it. From there, you go to the page you want to check.

## Open the door

You open Settings. **View as…** is the first chip under the search box at the top of the list, on every tab. Only devs see it. `/settings#view-as` opens it straight from the address bar. There are two lists:

- **Roles** has one line per role. Each is backed by its **sample account**, such as *Sample assistant* or *Sample estimator*. The chips beside a role are the switches its sample carries: {{chip:gray|training mode}} {{chip:gray|Hiring}} {{chip:gray|estimator prospects}}. You pick a role and you are that sample.
- **People** has every active person. You search by name, email or role. You pick one and you are them. Never a dev, because the login door refuses.

A teammate who is away is not on either list. That teammate's sign-in opens to one screen. Press **See what they see** on their Away row to look at it. See [leave a note for a teammate who is away](/help/leave-a-note-for-a-teammate-who-is-away#see-what-they-see).

Then you go to the page you wanted to check. That role may not be able to open it. Then the app sends them where it always sends them. That is itself the answer to "can they see this?".

## Come back

The amber {{button:gray|Exit (Sample assistant)}} in the header returns you to your own account **and to the page you left**. On a phone it is a thin amber bar across the top of the screen. A press anywhere along the bar works. Settings → *Back to my account* does the same.

Sometimes the app cannot put your own sign-in back. Then the app signs this browser out and shows the sign-in page. You sign in again as yourself.

## Sample accounts

They live under Settings → System → **Digital twins & samples**. They are hidden from every roster, picker, Person rail and notification, the way digital twins are. They are fixtures, never people. So they never get a roster row or pay. {{button:gray|Create the missing samples}} makes one per role that has none. {{button:gray|Manage accounts…}} beside it sets a sample's switches like anyone's. You turn on Hiring for *Sample assistant*, then View as it. The board shows exactly what an assistant with that switch gets.

They are not read-only. A sample can press a button, save a note or advance a candidate. That write is stamped with the sample's own name. You turn on **training mode** on a sample if you want a look-only one.

## What View as holds back

Looking is not using. The app saves some things by itself while a page is open, with no press from anyone. View as holds these back.

- The person's **last seen** time and their time in the app stay as their own use made them. People → Activity does not count your look.
- A salaried person's clock is not synced from your browser. The server fills their day by its own schedule.
- What is new for the person stays new. Your look does not mark an answer to their note or plan question as seen. The same holds for a bid request, a bid's notes, a first look and a law firm's answers.

A few pages still save small things by themselves, such as a count of the pages opened. So you open only the pages you came to check.

Everything you press still saves as that person. A press saves for a real teammate just as it does for a sample. So you look, and you press nothing you would not want under their name.

:::example Does an assistant see the Hiring pill?
Settings → View as… → **Assistant**. You are *Sample assistant*; open Prospects: no Hiring pill, because the sample has no Hiring switch. Exit. Settings → System → **Digital twins & samples** → {{button:outline|Desk}} beside *Sample assistant* → tick **Hiring board**. View as → Assistant again, back to Prospects: the pill is there.
:::

The older **Imitate** buttons on People → Users and the person desk still work. Since v2.3606 they land on the page you were on too.
