---
name: "Punch list: tick the card you are working on, and see who else is"
number: 418
group: close
status: built and live 2026-11-21 to 2026-11-22 on Taunya's two asks of 2026-11-21 · the tick as v2.8196 (#9255) · v2.8199 (#9272) · the claim as v2.8224 (#9287) · v2.8226 (#9299) · both migrations pushed · her answer of 2026-11-24 on the one open default (wipe it) as v2.8441 · left: five walks · 2026-11-24 walk 4 walked in the iPhone simulator, which is not a real phone, and it holds
summary: >
  A checkbox beside every card on /punch-list. Ticking it means "I am working on this". The tick is
  kept in the database, so it is the same on a phone and at a desk. Since v2.8226 a tick is a claim:
  everyone who can open the page sees who is working on a card. A claim goes quiet after 12 hours with
  no update, and the card then reads as free to pick up. Since v2.8441 the claimer's own tick is then
  wiped, and their card says so once. A card that moves to another section loses its
  ticks. Built, deployed and checked once on the live site by the dev account. Nobody but the dev and
  the app's sample leader account has used it yet.
next: Taunya and the second person each open /punch-list on their own computer. One ticks a card, the other reloads and should see that name on it (walk 1 below).
size: XS; left: walks only
blocker: a second person at another computer, and 12 real hours for walk 2.
ver: v2.8196 · v2.8199 · v2.8224 · v2.8226 · v2.8441
opinion: close it after walk 1 — the build is done and live; the other walks confirm what the tests already hold, and walk 1 is the one the second person needs
mockup: not required — the screen shipped; pictures at a phone's width and a desk's, light and dark, were sent to Taunya on 2026-11-21 and 2026-11-22
---

# Punch list: tick the card you are working on, and see who else is (#418)

## The ask

Taunya, 2026-11-21: *"on the https://clicktooling.com/punch-list page, I would like a checkbox that when I can click next to each punchlist item for myself to know if I am working on it or not, I would like the checkbox to be persistant between sessions if I unclick it or click it, and when a card is moved from ready to build to close out or any section to another the checkmark should be wiped"*.

The same day, once the tick was live: *"I think it might be a good idea for us to add to the punch list when a user has claimed a card that they are working on, And then they should release that claim after they've not updated the card in 12 hours. Does that make sense? If so, help me add it."* A second person on another computer was about to start working from the list, and nothing on the page said which cards were taken.

This card was opened on 2026-11-22 at Taunya's ask that every session still needing a walk has a card that says so.

## What was built

All seven PRs are merged and deployed. Nothing is open.

- **v2.8196** (#9255): the table `punch_list_ticks`, migration `20261121193000_punch_list_ticks.sql`, pushed 2026-11-21 right after the merge. One row per person and card number, with the card's section when it was ticked and the newest version of the build that made the tick. The four fences close it. Types in #9269.
- **v2.8199** (#9272): the checkbox in both views (By group and By number), 44 px for a thumb, named for a screen reader with the card's number. The **Working on** pill counts your ticks and narrows to them. A failed save puts the box back with the reason. A failed read leaves every card on the page and says so. Guide: `/help/work-the-punch-list`, section *Tick the cards you are working on*.
- **v2.8224** (#9287): migration `20261122000500_punch_list_claims.sql`, pushed 2026-11-22 right after the merge. Every dev and master now reads every tick. Each row carries the claimer's name, stamped by the database. Writing is still a person's own. Types in #9302.
- **v2.8226** (#9299): the claim. A line under the card's name says who is on it and how long ago the last update was. A claim goes quiet 12 hours after the newest of the tick, a **Still on it** press and the card file's last change on `main`. The build ships each card's last change with the burndown's history, and the live build was read to carry it on 2026-11-22. A quiet card reads *Free to pick up* with who had it. Guide section *See who is working on a card*.

- **v2.8441** (#9603): the claimer's own tick is wiped once their claim has been quiet 12 hours, on Taunya's answer of 2026-11-24. Their box is clear, their own page deletes the row, and for that visit the card reads *Your tick was cleared after 12 quiet hours. Tick the card again if you are still on it.* The delete names the time the page read on the row, so a claim renewed on another device is left alone. No card offers **Still on it** any more. No migration.

The rules are in `src/lib/todos/punchListTicks.ts` and `src/lib/todos/punchListClaims.ts`, each with tests. The fragments `docs/recent-features/v2.8196.md`, `v2.8199.md`, `v2.8224.md`, `v2.8226.md` and `v2.8441.md` hold the rest, and the migration docs say who reads what.

## What was checked

- **On the live site**, as the dev account at a desk's width: #413 was ticked, the page reloaded, and the tick was kept. That was done once after v2.8199 and again after v2.8226, when the card read *You are working on this. Last update just now.* Each tick was taken off, and the table held 0 rows after.
- **On the dev server against the live table**, two sign-ins in one headless Chrome: the dev account and the app's Sample leader account (a master) through View as. Each saw the other's claim by name. A card both ticked named both. Every tick was taken off.
- **On the dev server with a stand-in table and made-up names**, at 390 and 1280 px, light and dark: taken, two names, gone quiet and free, the viewer's own quiet claim, **Still on it**, a takeover, and a card ticked 40 hours ago kept fresh by a file change 3 hours ago.
- **A made-up card moved between two sections**, on the dev server: its tick was hidden. The dev server never deletes, so the row's delete was not seen.

## Left to do and to walk (2026-11-22)

### Walks

1. **A second person on another computer sees a claim.** Page: `/punch-list` on clicktooling.com. As whom: Taunya and the second person, each signed in as themself, a dev or a master. Widths: one at a desk, one on a phone, one of them in dark. What should be seen: Taunya ticks a card. The other person reloads, or brings the tab back to the front, and the card reads *<Taunya's name> is working on this. Last update …*. Their own box on that card is clear, and nothing on their page can take her tick off. Then the other person ticks the same card, and Taunya's page reads *You and <their name> are working on this.* Why not walked: only the dev account and the sample leader account have used it. Both were driven by a session in one browser.
2. **A claim goes quiet after 12 real hours.** Page: `/punch-list` on clicktooling.com. As whom: one person ticks, a second person looks. Width: any, light. What should be seen: pick a card that no session is editing, since any change to its file keeps the claim fresh. Tick it and leave it. After 12 hours the other person looks first and sees *Free to pick up. <name> had it and went quiet …*. Then the person who ticked opens the board (since v2.8441): their own box is clear and the card reads *Your tick was cleared after 12 quiet hours. Tick the card again if you are still on it.* The table then holds no row for that card, and after a reload the other person's card says nothing. The person who ticked reloads and the line is gone. They tick the card again, and it reads as taken to the other person after a reload. Why not walked: it takes 12 real hours. A quiet claim and a wiped tick were seen only on a stand-in table and in the tests.
3. **A real card that moves section wipes its tick, after the deploy.** Page: `/punch-list` on clicktooling.com. As whom: the person who ticked. Width: any. What should be seen: tick a card a session is about to move, for example a close-out PR changing its `group:`. After the deploy that holds the move, the card draws with no tick and no claim line. The person's own page also deletes the row, so the table holds no row for that card. Why not walked: the page deletes a stale row with no press only on the built site, never on a dev server. The delete is held by the hook's test alone.
4. **A real phone.** Page: `/punch-list` on clicktooling.com. As whom: Taunya. Width: an iPhone in Safari, light and dark. What should be seen: a thumb lands on the box first time, and on **Still on it**. The claim line wraps under the card's name and nothing runs off the side. Why not walked: the phone checks were Chrome at 390 px with touch, not a phone in a hand.
   - **In the iPhone simulator, 2026-11-24, holds.** iPhone 17 Pro on iOS 26.4, in Safari, as the dev, in dark and in light. **A simulator is not a real phone:** a press there is a point sent by a tool, not a thumb.
   - The box is drawn 20 by 20 px. A press 7 px above its edge ticked it, which fits the 44 px the code gives its label.
     Ticked, the card read *You are working on this. Last update just now.* in a green band under its name, on two lines.
     The band is 270 px wide and stops 16 px inside the card. Nothing ran off the side at 402 px, in either theme.
   - Two reloads kept the tick and the line, one in dark and one in light.
   - **Working on** counted 1 and narrowed the list to the card. It is 131 by 31 px, a pixel under the 32 px this card says.
   - Unticked, the line went and **Working on** read 0. With the filter still pressed the list read *No cards match the filters.* with **Clear the filters**.
   - The tick stood under three minutes on #119, a card nobody was on. The table read 0 rows before and after.
   - **Still on it was not seen.** It shows only on a claim gone quiet, which takes 12 hours.
   - **Still owed on a real iPhone:** a thumb on the box first time, and a thumb on **Still on it**.
5. **Training mode, a real master and View as.** Page: `/punch-list`. As whom: a dev or master in training mode, a real master's own sign-in, and the dev under View as. What should be seen: in training mode the claims read, and a tick goes back with a toast that says why. A real master sees every claim with its name. Under View as the page shows what that person sees and deletes nothing by itself. Why not walked: the walks were the dev and the sample leader only. The table's fences were read on prod when each migration was pushed.

### Loose ends

- **Taunya's call on one default: answered, wipe it.** She was asked on 2026-11-22 whether her own tick stays or is wiped after 12 quiet hours. Her answer came on 2026-11-24, relayed by Diane: *"Wipe it"*. v2.8441 did it: `OWN_TICK_AFTER_QUIET` in `src/lib/todos/punchListClaims.ts` is `'wiped'`, and the claimer's own page deletes the row. Both readings are still tested.
- **Still on it is on no card since v2.8441.** It was offered only on the claimer's own quiet line, which a wiped tick does not have. A person who is still on a card ticks it again after the 12 hours, or unticks and ticks it before. Whether a fresh claim should offer **Still on it** before its time is up is Taunya's call. No card holds it. Walk 4's thumb check of **Still on it** has nothing to press.
- **A wiped tick says so once, and that was a call.** The card reads *Your tick was cleared after 12 quiet hours.* on the visit that clears it and never again. The other choice was no word at all. v2.8441's fragment says why.
- **A quiet row goes only when its claimer opens the board.** Until then everyone else reads *Free to pick up* with who had it. Nothing else deletes it, and no job runs.
- **Two more defaults, built and stated in v2.8226's fragment.** Two people may hold one card, and the card names both. A change of the card's file by anyone keeps every claim on it fresh. A flag does not move a card, so a flagged card keeps its tick.
- **Sessions' claims are not on the page.** Sessions work most cards, and they have no way to tick. Their claims live in the repo's ledger as `refs/claims/*`, read by `npm run sessions`. The building session's read of how hard it is: those refs hold a version or a migration stamp and a branch, not a card number (39 of them on 2026-11-22), and the session cards that name a card are local files, not on GitHub. So the page cannot map them to cards directly. The nearest public sign is an open PR's title, which mostly carries *punch list #N*. The page could read the open PRs from GitHub's public API when it opens, with no sign-in (60 requests an hour from one address), and show *A session is on this: PR #N* on the card. That is S to M, one kernel and one line on the card. Baking it into the build instead would be stale between deploys. Whether to build it is Taunya's call. No card holds it.
- **The Working on pill is 32 px tall on a phone**, like the page's other filter pills. The checkbox and **Still on it** are 44 px.
- **The card-change time is as of the last deploy.** A change merged since counts once the site is built again. A renamed card file starts its time again under the new name.
- **Another person's stale row is only hidden** after their card moves. It is deleted when that person next opens the board on a newer build, since a person deletes only their own rows.

## Where it plugs in

- `src/pages/PunchList.tsx`, `src/components/punchList/PunchListTick.tsx`, `PunchListClaim.tsx`, `PunchListByNumber.tsx`.
- `src/hooks/usePunchListTicks.ts`.
- `src/lib/todos/punchListTicks.ts`, `punchListClaims.ts`, `punchListHistory.ts` (the `touched` field), `scripts/todos/readTodoHistory.ts` (each card's last change).
- `punch_list_ticks` on prod, `docs/migrations/20261121193000_punch_list_ticks.md` and `docs/migrations/20261122000500_punch_list_claims.md`, `docs/ACCESS_CONTROL.md` (*Punch list ticks*).
- Walk scripts used by the building session, outside the repo, in the session group's shared notes folder under `punch-list-ticks/`.
