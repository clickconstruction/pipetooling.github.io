---
name: "Document builder, what is left: the walks owed on prod, the builds left, and a way to tell one visitor from another"
number: 416
group: ready
status: written 2026-11-21 on Taunya's word, *save everything we should build, everything we didn't build and all of the walks we should do to a punch list card so another user on a different computer can pick up where we left off* · 2026-11-22 each walk given its page, its role, its test rows and its widths, and the loose ends named by PR, migration and row, on her word to record what is still owed on every card · the one home for the Document builder's leftovers · 2026-11-23 walks 1d, 1e and 1g to 1i walked on prod · 2026-11-24 walks 1b and 1j walked on prod, 1f held, 1k walked in the iPhone simulator, 1a and 1c walked on prod with the two undo presses · no build on this card is started
summary: >
  The Document builder (#404) is built but for steps 6 and 10, and live for a dev. This card is the
  one list of what is left, in the order to do it. First the walks on prod that no one has done yet,
  each with its page, who to sign in as, the test rows, the widths and what should show. Then the
  loose ends: PRs not merged, a migration not pushed, the test rows the walks left. Then the builds
  that are ready now, a way to see that the same person opened a link twice, and the builds that
  wait on one of Taunya's calls.
next: Part 1, the walks left. 1f waits on a person to set a billing job on the test project by hand, on Diane's yes of 2026-11-24, since no screen does and the session was refused. 1k holds in the iPhone simulator and still wants a real phone. Then remove the two test certificates and their two Drive files, named under the 2026-11-24 notes. Part 3 can start beside the walks. Parts 4 and 5 wait on Taunya's calls.
size: L as five parts (M · S · M · M · L), each alone
blocker: Walk 1f waits on a way to set and clear a billing job. None for 1k. The Sub NDA was published as revision 1 on 2026-11-23, on the owner's go. Parts 4 and 5 wait on Taunya's calls, each named on its line. An attorney's read of the Sub NDA and an insurance agent's read of the sheet come before anything goes to a real GC or a real trade.
opinion: build — the walks first, since each one proves code that is already live
mockup: not required — #404's mockup.html draws every screen here but the visitor lines in part 4, which are drawn first as that part's own step
---

# Document builder, what is left (#416)

This card is for someone on another computer who was not in the room. It is a list. The design,
the reasons and the record of what is built live on card #404, in
[document-builder/README.md](document-builder/README.md), and each line here links there rather
than saying it twice.

When a walk passes or a build merges, write its line on #404 under *Where it stands* and take it
off this card. When this card's list is empty, delete the card.

## Before you start

- **Read #404's opening, its mock-up and *Not legal advice*.** Every word and amount in the builder
  is a placeholder. No clause wording goes in the repo. The real words live in a private document,
  never here.
- **The office's side** is Documents → Document builder, at `/documents?tab=builder&builder=insurance`
  for the insurance sheet and `/documents?tab=builder&builder=sub-nda` for the Sub NDA. Only a dev
  sees the tab. Pick the job in the **Job** box.
- **Sign in as a dev** with `node scripts/dev-pane-login.mjs` and open its link. Never type a
  password, and never print the link or a live link's code. A page outside the app, the link at
  `/d/<code>`, a trade's page at `/t/<token>` and a customer's page at `/portal?t=<token>`, is opened
  signed out, in a private window.
- **Widths and themes.** The office's side at 730 px or a desk's 1200 px, and at 375 px, in light and
  in dark. A page outside the app at 375 px and 730 px. Each of the three is drawn light whatever the
  viewer's theme, so dark is not walked there.
- **The dev server writes to prod.** There is no staging. A press that saves writes the live row.
- **Deploys and pushes** follow `CLAUDE.md`. A function deploy needs Taunya's go naming the function.

### The test rows on prod

Use these and nothing else. A row a walk makes is named `ZZ Test …` and deleted after, or named in the
walk's line on #404 when a dev cannot delete it.

| Row | Where | Id |
|---|---|---|
| *GC test project, delete me* | `projects`, stage building, no billing job | `ef8905d1-039a-4cbc-9d69-9468cfea50e0` |
| Its insurance sheet | `document_builder_sheets`, revision 7 on the usual's revision 3, reading as revision 2 did | `5e93b85f-4d69-4d6d-8990-858556dd81f0` |
| Its five trades | `gc_trade_packages`: Concrete, Plumbing, Electrical, HVAC, Fire sprinkler. None awarded | Concrete is `7c7a509d-187c-48fe-8dda-9a5fef720e23` |
| *GC test trade company, delete me* | Asked on Concrete, not awarded, its page on | `ff11d0fb-269e-44de-b92a-e7256c180f67` |
| *ZZ Test trade two, delete me* | Asked on HVAC with a $15,000 quote, not awarded, its page off. A standing row since walk 1a: nothing removes a quote | `5a3fbc35-9ee0-485d-84a8-fe2ca388755a` |
| *ZZ Test trade no page, delete me* | On the Electrical bench, not asked, its page off. Left by walk 1c: the bench keeps it | `d6b9d4d9-4519-4067-b9f7-e6faed4a74a3` |
| *GC test bidding project, delete me* | `projects`, stage bidding, no sheet | `c4117b0d-0c64-4935-933f-01bd96bfef60` |
| *ZZ TEST GC On Notice* | `customers`, its page off | `1cd10f0f-04c3-410d-b34a-f0809e5240a5` |
| Its two ZZ TEST jobs | `jobs`, the GC on both is the customer above | `0e8dbf06-10bd-4288-a5fc-9be2740eaf5c`, `3426343e-77ea-4f23-a33c-ae74803fb361` |

**An address to send to.** Add a contact named `ZZ Test …` at `delivered+<label>@resend.dev`, the
mail provider's own sink, and pick it in **To**, since the company's main contact comes first. Delete
the contact after.

**Leave two rows as they are.** The usual insurance sheet (`document_builders` key `insurance`) is at
revision 3 with no agent's check. The Sub NDA (key `sub-nda`) is at revision 1 since 2026-11-23, on
the owner's go, not read by an attorney. Publishing either again is Taunya's.

**Never let the one press on the Sub NDA's GC card send.** It sends to every GC whose page is on, and
those are real customers. It asks first: read its question and press **Cancel**. Send to one test GC
from its own row.

## Part 1: walks owed on prod

Each of these is built, on main and held by tests. None has been seen on the live site. Each walk
puts its rows back after, and its line on #404 names what it could not delete.

**1a. The one press with two trades** (v2.8009, v2.8192)

- **Where:** the insurance sheet's send card, job *GC test project, delete me*. As a dev.
- **Rows first:** award the test trade company on Concrete. Make `ZZ Test trade two, delete me`,
  ask it on Plumbing and award it. Each with a sink contact.
- **Should show:** *Send to 2 trades who are ready*. Both rows read *Sent* after it. Undo both
  awards and take both sends off after.
- **Why not yet:** no trade on the test project is awarded, so the press has read *Nothing to send*.

**1b. Tell them it changed** (v2.8009)

- **Where:** the same card, then the trade's page `/t/<token>` signed out. As a dev, then signed out.
- **Rows first:** a send to the test trade company. Open it from the trade's page. Then publish a new
  revision of the test job's own sheet: change its place line, publish, change it back, publish.
- **Should show:** *Changed since they opened it* on the trade's row, with **Tell them it changed**.
  Its email reaches the sink, and the trade's page shows the newest revision.
- **Why not yet:** no walk had a trade open the sheet and then a new revision after.

**1c. A trade with no page** (v2.8009)

- **Where:** the same card. As a dev.
- **Rows first:** `ZZ Test trade no page, delete me`, asked on Electrical, with no page made.
- **Should show:** the row says it has no page. The one press holds it. A send to it alone makes
  the page, and the page opens at `/t/<token>`.
- **Why not yet:** the test trade company has had a page from the start.

**1d. A page that is off** (v2.8009)

- **Where:** the same card. As a dev.
- **Rows first:** turn the test trade company's page off. Turn it back on after.
- **Should show:** *Their page is off* on the row, a dead send, and **Turn their page on** as a press
  of its own. A send never turns it back on by itself.
- **Why not yet:** the page has never been off during a walk.

**1e. A lost or closed job in the job list** (v2.8192)

- **Where:** the **Job** box on the insurance sheet. As a dev.
- **Rows first:** mark *GC test bidding project, delete me* lost on the GC desk. Clear it after.
- **Should show:** the job leaves the **Job** box while lost, and comes back once cleared.
- **Why not yet:** prod has no lost or closed GC job. A lost job with a published sheet stays in the
  box, marked, and the usual's publish holds it. That half is held by tests, since the usual must
  not be published for a walk.

**1f. A sent copy with a job** (v2.8190)

- **Where:** Documents → Sent copies. As a dev.
- **Rows first:** set a ZZ TEST billing job on *GC test project, delete me*. Send the sheet to a sink
  contact. Clear the billing job after.
- **Should show:** the copy under *Contracts and estimates*, naming that job.
- **Why not yet:** neither test project bills through a job, so their copies name none.

**1a to 1f, on clicktooling.com on 2026-11-23.** As a dev, on the test rows.

- **1d holds, with one gap.** **Turn it off** on the test trade company's portal (GC desk → Trade partners → the company → **Their portal**) asked *The link stops working* first.
  The sheet's row then read *Their page is off*, and **Send it again** was dead.
  There was no **Turn their page on** on the row: it shows only inside the send box, which a dead press cannot open, so a page is turned back on from the GC desk alone.
  **Make the link** there turned it on with a new link, so the trade's old link is dead.
- **1e holds.** **We lost this** on *GC test bidding project, delete me*, with *Project died or on hold*, took the job out of the sheet's **Job** box.
  **Bring it back** put it back under Bidding, and the box lists it again.
- **1b, in part.** A ZZ person at a sink address was added from the trade's own page, ticked for **Pay and papers**, since the company's two addresses are `example.com`.
  The sheet went to that person, and the row reads *Sent Nov 23 to* that person, *Not opened yet*.
  The trade's open was not counted: the trade's page was opened in a browser signed in as a dev, and the function counts only someone outside.
  The rest of 1b waits for a signed-out browser.
- **1a held.** An award cannot be undone by a dev, since the award guard refuses any change outside the award itself. So *undo both awards* is SQL, or the awards and their draft statements of work stay on the test rows. That is the owner's call.
- **1c held.** The test project has one trade, so 1c means a new trade company asked on a new package, and the card does not say how either comes off again.
- **1f not started.** It needs a dev's presses, and the browser pane stopped taking presses partway through this sitting.
- **Left on production.** The ZZ person on the test trade company. One live send of the sheet to that person, with its email, its log row and its Sent copy. The test trade's portal link of 2026-10-08, turned off, and a new one made the same day.
- **Seen, not fixed.**
  - A sent row whose trade's page is off offers no **Turn their page on**.
  - The trade's page, opened by a signed-in dev, is not counted as the trade's open. That is as designed, but it means a dev cannot walk an open from the same browser.

**1b, 1f and 1j, on clicktooling.com on 2026-11-24.** As a dev in a headless browser, with the trade's page opened in a second browser that has no sign-in. The office's side was read at 1200 px and 375 px, light and dark. The trade's page was read at 375 px and 730 px.

- **1b holds.**
  - The send of 2026-11-23 had been taken off and its ZZ person removed before this walk began, so the walk made both again.
  - A ZZ person at a sink address was added from the trade's own page, ticked for **Pay and papers**.
  - **To** read that person, the press read **Send to ZZ**, and the row then read *Sent Nov 24 to* that person, *Not opened yet*.
  - Signed out, the trade's page showed *What your certificate must show* with the job and a *New* chip. **Open the sheet** drew revision 2, and the office's row then read *Opened Nov 24*.
  - The place line was changed and published as revision 3, then put back and published as revision 4. The publish asked nothing first.
  - The row read *Changed since they opened it* with **Tell them it changed** at all four looks, with nothing past the edge. The trade's page read *Changed since you opened it* at both widths.
  - **Tell them it changed** was dead until **Send it anyway** was ticked. The line under it named the sink person and address. Pressed, the row read *Sent Nov 24*, *Not opened yet* and **Send it again**.
  - The mail log holds both emails to the sink address, the first as *delivered* and the second as *sent*. The sink's own inbox cannot be read from here.
  - Signed out again, **Open the sheet** drew *Revision 4* with the place as it was, and the office's row read *Opened Nov 24*.
- **1j holds, but for the email of a send-back.**
  - #9337 is on main as v2.8264, and a Pages deploy of a later commit had finished.
  - A made-up one-page PDF went up from the trade's page, signed out, at 375 px, with a run-out day a year ahead. **Send it to Click** is live with a file and no day.
  - The card read *1 certificate to check*, and the row read *Certificate came in Nov 24* with **Check it against the sheet**.
  - The check list gave **Open their file**, *They sent it Nov 24* and 8 lines for revision 4: the name, the place, the holder and five coverage lines. *Good until* began on the day the trade gave.
  - At all four looks, with no line ticked the first press read *0 of 8 checked*, dead, and **Send it back** was dead. With seven ticked it read *7 of 8 checked*, dead, and **Send it back, naming 1 thing missing** was live.
  - With every line ticked and a day ahead it read **Mark it good**, live. With today or a past day it was dead under *That day has passed. Ask them for the current certificate.* With no day it was dead under *Say the day it is good until.*
  - **Mark it good** made the row *Certificate good to Nov 24* and the count *Every trade has a certificate.*
  - The foot line alone was changed and published as revision 5, and the row stayed good.
  - One amount was changed and published as revision 6. The row read *The sheet changed since their certificate* with **Check it again**, and the count read *1 certificate to check.*
  - **Check it again**, with the changed amount left unticked, then **Send it back, naming 1 thing missing**. The row read *Sent back Nov 24, 1 thing missing* with the line under it, and the count read *1 trade has no good certificate.*
  - **The email did not go.** `gc-trade-email` answered 502, and the card said *It is marked as sent back. The email to them did not go. The email did not go out. Try again in a minute.*
  - The function's own reason is the mail service's: *Invalid `to` field. Please use our testing email address instead of domains like `example.com`.* The company's main contact is at `example.com` and comes first in **Pay and papers**, so the whole email is refused, the sink in copy with it. The email cannot be walked on this test company as it stands.
  - A second file went up through **Send a newer one** at 730 px. The sheet's row read *Certificate came in Nov 24* again, and a second send-back got the same answer.
  - Both fields were put back with **Back to the usual** and published as revision 7.
- **1f held.** No screen sets a billing job on a GC project or clears one.
  `gc_projects.billing_job_id` is written by a sent pay application, a sent interest bill and a job combine, and by nothing else.
  So the walk's first step is a row written by hand, and that is the owner's call.
  Diane allowed that one write on 2026-11-24, for that row and that column and no wider.
  The session's auto mode refused it at about 07:14 UTC, and no other door was tried, so nothing was written and the column reads empty.
  1f waits for a person to set the column and clear it after, or for a press that does.
  Seen without it: today's two copies are under Sent copies, *Contracts and estimates*, as *Insurance sheet email* to the test trade company, and they name no job.
- **Left on production.**
  - The test sheet at revision 7, reading as it did at revision 2.
  - One send, `986a6039-aed2-41b6-ad3f-8be1b1d4eb10`, sent twice and taken off. Its two email log rows, `001a2aa4-faf4-4d7a-aa5e-44f799d4a648` and `2b1e1d20-e6e3-44fe-89b3-2abdd0a88afd`, and its two Sent copies, `886b9867-3364-4bda-960c-49c984d73022` and `a407f609-26b6-4602-858b-4d9551e564e4`.
  - Two ZZ people, `1841fe2f-c4e9-4f96-9814-17cf916f4d11` and `c01c7426-2184-484d-bb28-17fdde576da6`, both removed from the trade's page. The second was added for 1f and sent nothing.
  - Two certificates on the test trade company, `5d7385db-814a-4535-8ea1-3c33c1a7d59a` and `bd8d0d89-1041-46dd-af78-4c3e0f5baac1`, and their file rows in `gc_trade_files`, `b0fea0f6-1947-43b8-b421-8504e19c4841` and `6f899892-6805-4898-a35e-4b8ff0f1d544`. The database lets a dev delete a certificate, but no screen found offers the press for a trade company's, so they stay.
  - Two Drive files in PipeTooling Jobs → Jobs → GC trade partners → GC test trade company, delete me: `2026-11-24 0044 - ZZ Test certificate 416.pdf` and `2026-11-24 0100 - ZZ Test certificate 416.pdf`. The Drive account this session reaches may read them and may not trash them, so they are a person's to remove.
  - The trade's portal link of 2026-11-23 reads *Opened 20 times*, from the signed-out looks.
- **What the two certificates change on the test rows.** The company's own record now reads *Insurance certificate, good to Nov 24* and *Certificate from their portal, waiting for your look*.
  Anything that reads the company's own certificate now finds one, which was not so before this walk.
- **Seen, not fixed.**
  - *Certificate good to Nov 24* drops the year, so a certificate good for a year reads as if it runs out today. The trade's page and the company's record say it the same way.
  - After a send-back the card says *Try again in a minute*, and the row has no press to try with. The reason the function gave is not shown.
  - After a send-back the trade's page reads *good to Nov 24 · Click is checking it*, and its *Needs you* no longer asks for a certificate. The company's record still offers **Mark it good**.
  - A certificate marked good and then sent back keeps `status` `signed`, which is why the company's record still reads it as good.
  - No group email reaches the test trade company, since its main contact is at `example.com`. A walk that needs one needs that contact at a sink address first.
  - ~~Publishing a job's sheet asks nothing first.~~ Fixed by v2.8511 (PR #9688), on Diane's yes of 2026-11-24: a job's publish and the usual's publish each open a window first, which says who sees the new revision and that a publish cannot be taken back, and **Not yet** publishes nothing. The Sub NDA's publish asks since v2.8439 (below). Held by tests, and not yet seen in a browser.
- **For the next headless walk.** A new browser for every look pulls every file again, and GitHub Pages answered *Rate limit exceeded* after about forty loads in half an hour. The app then read *The app is slow right now.* A browser profile kept on disk stopped it.
  A first visit to `/gc` in a new profile draws a walkthrough over the page, and Escape closes it.

**1a and 1c, on clicktooling.com on 2026-11-24.** As a dev in a headless browser, once both undo tools were pushed and a deploy carried their presses. This walk was their first use on the live site. Each company's page was opened in a second browser with no sign-in. The office's side was read at 1200 px and 375 px, light and dark, and a company's page at 375 px and 730 px.

- **1c holds, and its ask came back twice.**
  - `ZZ Test trade no page, delete me` was added on Trade partners under Electrical, with a sink address and *We have worked with them* ticked.
  - **Ask for quotes** on Electrical made the ask, with **Email the invitations now** left unticked. Its row read *has not opened it* with **Will not do it**, **Cannot do it** and **Take the ask back…**.
  - On the sheet the row read *Electrical · asked, not awarded* and *No page yet*. The one press read *Nothing to send*, dead, and held it as *asked and not awarded. Send to them alone.* The same at all four looks.
  - **Take the ask back…** asked *Take the Electrical ask back from* the company, and said it *has not opened this ask, sent a quote or heard from us about it. The ask is deleted, and they read as never asked on Electrical. You can ask them again.*
  - **Cancel** changed nothing. **Take the ask back** took the ask off, and the trade read **Ask for quotes** again.
  - Asked again the same way. On the sheet its box said the company *has no page yet. Sending makes one.* **To** read the sink person, and the press read **Send to ZZ Test 416 sink**.
  - Sent, the row read *Sent Nov 24* and *Not opened yet*, and *No page yet* was gone. **Their portal** on the company read *Made Nov 24. They have not opened it yet.*
  - Signed out, the page opened at `/t/<code>` at both widths with no sideways scroll. It drew the welcome, the ask to quote Electrical and the sheet marked *New*.
  - After: the send was taken off. The ask still read *has not opened it* and still offered **Take the ask back…**, and it came back a second time. The sheet's email and a look at the page's first screen are not about the ask. The page was turned off.
  - **Remove from the bench…** was refused: *ZZ Test trade no page, delete me stays on the bench, since they wrote to us from their portal.* So the company stays.
- **1a holds, but the one press did not reach the test trade company.**
  - Plumbing on the test project is our own crew and cannot be awarded, so the second trade is HVAC.
  - `ZZ Test trade two, delete me` was added under HVAC with a sink address and asked with no email. **Make the link** made its page.
  - Signed out on its page, **Send my quote** was dead under *Open the plans first.* until the plans were opened. A made-up quote of $15,000 went in.
  - **Award and draft the statement of work** in Compare quotes awarded Concrete to the test trade company at $12,500 and HVAC to the second company at $15,000. Each got a drafted statement of work. Nothing was sent to sign.
  - On the sheet both rows read *awarded*, and the one press read **Send to 2 trades who are ready**, dead until **Send it anyway** was ticked. The same at all four looks.
  - Pressed, it read *Sent to 1 trade. 1 did not send.* The second company's row read *Sent Nov 24*. Under the press: *GC test trade company, delete me: The email did not go. Nothing was recorded. Try again. The reason: Invalid `to` field. Please use our testing email address instead of domains like `example.com`.*
  - The one press goes to each company's first contact, and that company's first contact is at `example.com`. The press then read **Send to 1 trade who is ready**. So one row read *Sent*, not both.
  - After: the send was taken off. **Take the award back…** beside *Awarded* in Compare quotes asked *Take the HVAC award back from* the company.
  - It said *The award comes off, and the drafted statement of work for $15,000 is deleted. Their quote and the ask stay, and HVAC can be awarded again.* It also said their portal told them they got the job if they opened it since.
  - **Cancel** changed nothing. **Take the award back** took the award and the draft off, on HVAC and then on Concrete. Each trade read *not awarded* with its quote in.
  - Each company's Activity gained *Award taken back on* the trade, with who awarded it, the price and *The drafted statement of work went with it.*
  - The second company's page was turned off. Its ask on HVAC holds a quote, so it has no **Take the ask back…** and no **Remove from the bench…**. It stays as a standing test row.
- **Left on production.**
  - `ZZ Test trade two, delete me`, with its ask `3fc3f0d3-8123-4897-b220-873c8e5d751d` on HVAC, its quote, its page link `04aff26c-8240-4eae-8b9d-989563c14934` turned off, and one note of the take-back.
  - `ZZ Test trade no page, delete me`, with no ask and its page link `e183fdc2-6b9d-4a71-b645-18d12c86cac7` turned off. Its two asks left a row each in `gc_asks_taken_back`, which the dev seat's catalog does not know yet, so those were not read.
  - One note of the take-back on the test trade company.
  - Two sends of the sheet, each taken off: `bed18204-406c-4c68-bf22-36676b5238e2` and `3607894a-2897-44f5-89d8-02b2bbabb8ac`. Their email log rows, `a2f5226b-3e51-4984-999f-ce5d68dd6c72` and `cc4fd285-1051-4a40-88bf-6fef84b93619`, both read *delivered* to a sink. Their Sent copies are `5a0bef61-269c-4037-a864-693093cdea72` and `cdb29857-56ca-4a7d-a08d-8d2b60f59953`.
  - No award and no statement of work. All five trades read not awarded, read back through the dev seat.
- **What it changes on the test rows.** The test sheet's send card now lists two trades, since the second company's ask on HVAC stays.
- **Seen, not fixed.**
  - ~~The one press sends to each company's first contact and names nobody before it goes.~~ Fixed by v2.8487 (PR #9659): above the one press a line for each company says who its email goes to, by name and address. More than three lines fold under *See who the N emails go to*. The press still sends to each company's first contact. Held by its tests and carried by a deploy of 2026-11-24. Not walked on the live site.
  - ~~The ask window says *1 email goes out, each with the company's own portal link* while **Email the invitations now** is unticked and no email goes.~~ Fixed by v2.8487 (PR #9659): with the tick off the window reads *1 company is asked.* and names no email. With it on, one company reads *1 email goes out, with the company's own portal link.* Held by its tests and carried by a deploy of 2026-11-24. Not walked on the live site.
  - ~~**Remove from the bench…** first says the company has *no contact logged*, then refuses because *they wrote to us from their portal*. The company wrote nothing. What holds it is the sheet we emailed.~~ The refusal's words are fixed by v2.8491 (PR #9661), whose migration was pushed on 2026-11-24: it reads *stays on the bench, since we emailed them*. The rule is the same and the company stays. Seen live on 2026-11-24 on *ZZ Test trade no page, delete me*. Still so: the row offers the press on a company we emailed and says *no contact logged* first, since the office cannot read the emails we sent.
  - The ask-back window says the company has not heard from us about it, after the sheet for that job was emailed to it.
  - ~~The Concrete quote ran out on Nov 7 and was awarded with no word about it.~~ Fixed by v2.8487 (PR #9659): under the award press a line reads *Their number ran out Nov 7. Ask them whether it still holds.* The press then asks first, and its yes reads **Award on this number**. The award is asked about, not blocked. Held by its tests and carried by a deploy of 2026-11-24. Not walked on the live site.
  - The awarded Concrete trade read *Insured to Nov 24*, from walk 1j's test certificate, with no year.

**1g. The Sub NDA's Publish and its attorney's mark** (v2.8024)

- **Where:** `/documents?tab=builder&builder=sub-nda`. As a dev.
- **Rows first:** Taunya's yes to publish the placeholder draft as revision 1. A publish cannot be
  taken back, and every GC sent it later reads that revision.
- **Should show:** **Publish revision 1**, then the bar reads revision 1. **Not read by an attorney**
  asks who read it. Press **Cancel** there: a walk records no attorney's read.
- **Why not yet:** the Sub NDA on prod was never published, and publishing it is Taunya's.

**1h. The Sub NDA's link** (v2.8150, PR #9186)

- **Where:** the link card under the Sub NDA's map, as a dev. Then `/d/<code>` signed out.
- **Rows first:** 1g. The link is switched on for the walk and off after.
- **Should show:** the page named *Secrecy on your jobs* at revision 1, look only, walking to step 11
  with no press on the last. **Who opened it** lists the open. Switched off, the address reads
  *This link is no longer open. Ask for a new one.*
- **Why not yet:** a link shows only a published revision, and there is none.

**1i. Send the Sub NDA to a GC** (v2.8151)

- **Where:** **Send it to a GC** under the Sub NDA's link, as a dev. Then that customer's page
  `/portal?t=<token>` signed out.
- **Rows first:** 1g. A contact named `ZZ Test …` at a sink address on *ZZ TEST GC On Notice*. Its
  page is off, so press its row's turn-on, which makes the page. Send from its own row only.
- **Should show:** the one press's question before anything goes, then **Cancel**. From the row, the
  email at the sink and the row reading *Sent* with the day. On their page, the builder under the
  job it is about, which walks the published Sub NDA look only, with no press on the last step. The
  row then reads *Opened*. **Take it off their page** takes it off.
- **After:** turn the page off again and delete the contact. A dev cannot delete the send's row, its
  thread line or its email log row, so name them on #404.
- **Why not yet:** the send answers that the Sub NDA is not published.

**1g to 1i, walked on clicktooling.com on 2026-11-23: hold.** On the owner's go of the same day, as a dev, with the signed-out pages opened in a second browser.

- **1g.** **Publish revision 1** published at once. The bar reads *Published, revision 1* and *Everyone outside sees revision 1, as you do*.
  **Not read by an attorney. Mark it read** asked *The attorney who read it*, with **Mark revision 1 as read** dead while the box is empty.
  **Cancel** recorded no read, and the mark still reads *Not read by an attorney*.
- **1h.** **Switch the link on** made `/d/<code>`, *Not opened by anyone outside yet*.
  Signed out, it opened as *Secrecy on your jobs*, revision 1, and walked to step 11, the Review, whose only press is **Back**.
  **Who opened it** then listed one open: *Someone with no account*, the browser and the time zone.
  **Switch the link off** asked first, and after it the address reads *This link is no longer open. Ask for a new one.*
- **1i.** The one press **Send to 4 GCs who are ready** is dead until **Send it anyway** is ticked.
  Pressed, it asked *Send to 4 GCs? Each gets an email now, about all their jobs with you.*, and **Cancel** sent nothing.
  On the ZZ TEST GC's own row, its box said the page was off since Nov 20, with **Turn their page on**, and the send press was dead until it was on.
  Sent about the ZZ TEST sink job to a ZZ contact at a sink address, the row read *Sent Nov 23*, then *Opened Nov 23* once its page was opened signed out.
  Their page showed *Secrecy on this job* under that job, and the builder walked to step 11 with only **Back**.
  **Take it off their page** took it off with no question, and their page no longer shows it.
- **Left on production.** The Sub NDA at revision 1, not read by an attorney. Its link, switched off. One `document_builder_sends` row, taken off. One `email_send_log` row to the sink. One portal link on the ZZ TEST GC, turned off again. The ZZ contact is deleted. JP9309 carried the ZZ TEST GC as its customer for a few minutes, to reach the page's off switch, and reads as before.
- **Seen, not fixed.**
  - ~~**Publish revision 1** asks nothing first, though a publish cannot be taken back. Switching the link off asks.~~ Fixed by v2.8439 (PR #9646), on Diane's yes of 2026-11-24: the press opens a window that says who sees the new revision and that a publish cannot be taken back. Its press reads **Publish revision N**, **Not yet** publishes nothing, and a dead press opens no window. Seen live on 2026-11-24, below.
  - Revision 1's words name the company *Acme Plumbing*, the placeholder, wherever the paper names us.
  - Once the ZZ TEST GC's page was on, the one press counted it among the GCs who are ready. Read again on 2026-11-24 and not a fault today: the tab and the send function are a dev's alone, and for a dev the count is true, since the press does send to that GC while its page is on. The list does not follow the dev's ZZ switch (#61). The day the tab opens to the office, the GC list must take `hidesZzTestJobs(role)`, or an office batch reaches a ZZ GC whose page is on. Seen live on 2026-11-24: the one press read *Send to 4 GCs who are ready* with the ZZ GC's page off and *Send to 5* while it was on.
  - A GC's page can be turned off only from the portal globe, which shows for a job's customer. A GC that is no job's customer has no off switch within reach. Read again on 2026-11-24 and not so: the globe is beside every customer's name on Customers, on a job or not, and its gear holds **Turn off**. The walk missed it because Customers hides a ZZ customer from a dev until the Pipeline's switch shows ZZ test jobs. Walked so on 2026-11-24, below: the page was turned off from Customers, and no job borrowed the customer.
  - ~~The send press names the contact by the first word of its name, *Send to ZZ*.~~ Fixed by v2.8433: the press names the contact by its whole name, or by the address when the record keeps no name. Seen live on 2026-11-24, below.
  - ~~Removing a customer's contact asks nothing first.~~ Fixed by v2.8438, on Diane's yes of 2026-11-24: **Remove** asks first and names the person, and says a dev can put them back for 90 days from Recently deleted. The 90 days was read in the migrations. Seen live on 2026-11-24, below, where the restore was previewed and not run.

**The five small-fault fixes, walked on clicktooling.com on 2026-11-24: hold.** On Diane's go of the same day, as a dev in a headless browser at 1200 px, light. Not walked: 375 px and dark.

- **The held list (v2.8435).** Under the one press it read one closed line, *Held: 16 GCs have no page yet. Send to one alone to make its page.* A press on the line opened sixteen names, with nothing past the edge. The ZZ TEST GC, whose page was off, kept a line of its own.
- **The send press (v2.8433).** With a contact named *ZZ Test Walk Sink* at a sink address, the press read **Send to ZZ Test Walk Sink**. It was dead while the page was off, and dead until **Send it anyway** was ticked.
- **How many times it went (v2.8437).** Sent about the ZZ TEST sink job, the row read *Sent Nov 24 to ZZ Test Walk Sink* and *Not opened yet*. After **Send it again** it read *Sent 2 times, last Nov 24 to ZZ Test Walk Sink*. The function answered 200 both times.
- **Publish asks first (v2.8439).** **Nothing to publish** opened no window. With one letter typed, the press read **Publish revision 2** and opened *Publish revision 2*: *Everyone outside sees revision 2 from now on. That is each GC you sent it to and anyone with the link. A publish cannot be taken back. A later revision can only replace it.* The focus sat on **Not yet**. **Not yet** and Escape each published nothing. The letter was taken back and the press read **Nothing to publish** again.
  - The draft's save was answered in the browser for this look, so nothing was written to the Sub NDA's row. Read again from the database it is at revision 1, with its draft as published.
- **Remove asks first (v2.8438).** **Remove** opened *Remove ZZ Test Walk Sink from this customer's contacts? A dev can put them back for 90 days, from Recently deleted in Settings.* **Keep them** wrote nothing. **Remove ZZ Test Walk Sink** removed the contact.
- **Recently deleted, previewed and not run.** The contact sits in one bundle, *Under customer ZZ TEST GC On Notice*, beside a ZZ contact of 2026-11-23 and a ZZ project another walk deleted. **Preview restore** answered that it would put back four rows with no blocker: one project, one superintendent row and two contacts. It was not pressed further, since the restore would bring the project back.
- **The page's off switch.** On the Pipeline, the *6 ZZ test jobs hidden* chip opens **Hide groups…**, and the *ZZ test jobs* line there is the switch. With it on, Customers showed the ZZ TEST GC with its globe. The gear's **Turn off** asked *Turn off ZZ TEST GC On Notice's portal?*, and the globe then read *portal is turned off*.
- **Left on production.** One `document_builder_sends` row, taken off. Two emails to the sink address, with their log rows and Sent copies, which no press deletes. One portal link on the ZZ TEST GC, made and turned off again. The contact *ZZ Test Walk Sink*, removed and in Recently deleted. The Sub NDA is as it was.
- **Seen, not fixed.**
  - A contact cannot be put back alone. Recently deleted groups a customer's deletions as one bundle, so a restore brings back every contact and project deleted under that customer. The confirm's words are true, but the restore is wider than they say.
  - ~~The remove window opens with the focus on **Remove …**, so Enter removes.~~ Fixed by v2.8515 (PR #9689): the window opens with the focus on **Keep them**, as the Publish window opens on **Not yet**. Held by tests, and not yet seen in a browser.
  - In the Publish window **Not yet** and **Publish revision 2** are drawn alike, both filled blue.

**1j. Step 6, a certificate checked against the sheet** (v2.8253, PR #9337)

- **Where:** the insurance sheet, job *GC test project, delete me*, the card **Certificates for this
  job** under the send. As a dev. Then the trade's page `/t/<token>` signed out.
- **Rows first:** #9337 merged and its Pages deploy finished. A made-up PDF uploaded as the test trade
  company's certificate from its own page, which files it to Drive under GC trade partners.
- **Should show:** *Certificate came in* with the day. **Check it against the sheet** gives one box to
  tick for each line the published sheet asks. **Mark it good** stays dead until every line is ticked
  and *Good until* is a day ahead. Then the row reads *Certificate good to* that day.
- **Then:** publish the job's sheet with a changed amount, and the row reads *The sheet changed since
  their certificate*. Change only the foot line instead, and it stays good. Check it again, untick
  one line, and press **Send it back, naming 1 thing missing**. The row reads *Sent back* with the
  day and the line, and the email goes to the company's example.com contacts.
- **After:** delete the certificate's row, which a dev may, and the Drive file. The sheet's extra
  revisions stay as test data.
- **Walked:** on 2026-11-24, in the notes of that day above. The screens, #9337, merged on 2026-11-22
  as v2.8264.

**1k. A link opened from a real phone** (v2.8194)

- **Where:** the insurance sheet's link card, as a dev. Then `/d/<code>` on a real phone, signed out.
- **Rows first:** the test sheet's link switched on for the walk and off after.
- **Should show:** the open listed under **Who opened it** with the phone's browser, and the sheet
  fitting the phone with no sideways scroll.
- **Why not yet:** every walk so far used a narrow desktop browser.

**1k, in the iPhone simulator on 2026-11-24: holds there.** Walked by another session, in the iPhone 17 Pro simulator's Safari, never signed in. A simulator is not a real phone.

- **Switch the link on** made a new link, on from 07:19:28 to 07:22:17 UTC.
- The phone drew the published sheet, revision 7, light, as a 370 px paper in a 402 px screen. A sideways swipe moved nothing.
- Under the paper, **Print this sheet** is 140 by 44 px. It was measured, not pressed.
- **Who opened it** then listed one line: *Someone with no account*, the address, *Safari on iPhone* and *America/Chicago*.
- **Switch the link off** asked first. After it the same address read *This link is no longer open. Ask for a new one.*
- **Left on production.** One link, `5e344bba-9f0b-4293-83ac-6e7e64863e24`, switched off, and its one open, `5cfdd6e9-76d5-4609-b19c-2f13f9fb2ecc`. A dev cannot delete either.
- **Not proven by a simulator.** A real phone's own browser line, an open from a cellular address, Android Chrome, and a fingertip on **Print this sheet**. Those are what a person's phone still owes this walk.

**Not walkable.** A link made under the service key before the link's own secret (v2.8189): prod held
no such link when the secret was set, and the tests hold that path.

## Part 2: loose ends

### Step 6 is on main

- **Step 6, a certificate checked against a job's sheet**, on Taunya's call of one certificate for
  each job. Nothing of it is in flight.
  - The ground, v2.8253 (PR #9325), merged on 2026-11-22 at 07:06 UTC. Its migration
    `20261122021800_coi_checked_against_a_sheet.sql` was pushed alone and proven on prod: the seven
    `sheet_*` columns, the check, the index, and the two functions, callable by a signed-in person
    and not by anon. PR #9371 records the push on the migration's page.
  - The screens, v2.8264 (PR #9337), merged on 2026-11-22, with their fragment. Step 6 added no function:
    its send-back email goes through `gc-trade-email`. Its walk is 1j, walked on 2026-11-24.
  - **The types caught up.** `src/types/database.ts` names the seven `sheet_*` columns and both
    `document_builder_coi_*` functions, and the dev seat's catalog names the columns. The seat read them
    on the 2026-11-24 walk.

### What is pushed and deployed

- Every Document builder migration on main is pushed. The newest is step 6's `20261122021800`.
- `document-builder-link` and `document-builder-send` (version 5) and `gc-trade-portal` (version 184)
  were deployed from main on 2026-11-21 at 23:44 UTC. `customer-portal` was deployed the same day for
  step 9. No Document builder change on main has landed in a function since.
- `DOCUMENT_BUILDER_LINK_SECRET` is set on prod.
- `dev-mcp` ran 0.132.0 on 2026-11-24. Its 0.125.0, with v2.8257's paper-words verbs, was deployed on 2026-11-22 at 06:13 UTC.

### Test rows the walks left on prod

Nothing here is owed. A dev cannot delete a send's row, its thread lines, its email log rows or a
filed copy's file. The links and the opens were not tried.

| Rows | Ids |
|---|---|
| Four sends on the test sheet, each taken off the trade's page | `619b60b5-49b1-47b4-af13-c02b8d3e8ae3`, `f479856f-eece-4a32-ae7f-4c804dfb9a7e`, `eda4a0b6-5572-49fd-9eca-5f3339b5c5f8`, `8623b894-de3f-484a-ae4f-c42affedd621` |
| Eight links on the test sheet, all ended | `1e41ef40-aaca-4292-9232-4fa8c6954218`, `690a8c7d-b327-4ac7-b860-8b189992766c`, `8f6fd086-5b6e-4f99-b4ee-b0f8c137d289`, `95520616-d1c9-4395-8820-ed5280a1c752`, `aaefdbed-6394-4de2-9566-48d8223ece20`, `536dcbc3-cb26-49d3-a9d1-d7788a9c55ee`, `fee055c5-99eb-4112-a9d6-4c203c1b31ed`, `daff515e-3993-4c69-8fff-ff8f3e14987c` |
| Three opens, on the fifth and sixth links | `5613e3a2-1960-40b4-ae39-a34ec2212535`, `a65f8a58-3add-4fb8-b912-0c5501876bbe`, `1bc82a9d-d916-4efe-9a6f-b96c1f2b24da` |
| Two Sent copies from the walk of 2026-11-20 | `85f96fee-741e-4759-aa01-bebd31ddd81d`, `d0d836f1-2a19-4959-a2d5-b9eab1bbd1d5` |
| One contact on the test trade company, *ZZ Walk Sink, delete me* | `e287044c-57d9-4c84-ba88-6d0257960715` |
| Two thread lines from the send of 2026-11-21, in `gc_trade_messages` | `02580fdf-c797-448b-8429-ce16b276b18c`, `e9a8894b-f7df-4da8-b30d-1bbfaf618c31` |
| Its email log row, and the reminder's own row beside it | `76f17735-e5b6-41f1-94e9-4e4a569924d0` |
| Two copy files in the private `sent-documents` bucket, whose rows were deleted | `cf604715-da10-4afe-bdbd-f07ad35edaad/copy.html`, `fb345e95-fe22-4728-a2c8-373741dc5563/copy.html` |

A dev can delete the two Sent copies and the contact. Delete them on the next walk.

### Faults seen and not fixed

- ~~**Send it again on the same day changes nothing on the row.** It still reads *Sent* with the same day, and how many times it went is not shown.~~ Fixed by v2.8437: a row sent more than once reads *Sent 2 times, last Nov 22 to* the person, and the day is the last send's. Seen live on 2026-11-24, in the walk under 1g to 1i.
- ~~**The GC card's held list runs long.** Under the one press it is one line for each GC with no page, which is most of them.~~ Fixed by v2.8435: a reason that holds more than three GCs reads as one line with its count, and a press on it opens the names. Three or fewer keep a line each. Seen live on 2026-11-24, in the walk under 1g to 1i.
- **Step 6 leaves four things**, as its own fragment will say:
  - a trade's own page does not say its certificate was sent back, or that the asks changed
    (`gc-trade-portal`);
  - a trade's upload still files one waiting certificate a company, with no job on it
    (`gc_trade_files` refuses a project on a certificate);
  - GC mode's start gate still reads the company's own certificate;
  - a certificate the office filed by hand (`gc_record_company_coi`, signed, no job) is not offered
    for the check.
- **A builder holds no clause wording.** A walked builder has no field for an agreement's own
  sections. So the Sub NDA's words load in two parts: its topics and levels into the builder's
  draft, and its agreement text into the Contract Book as an entry.

### Known limits, left alone on purpose

- A published Sub NDA that fails a later rule reads as no published revision, which hides the changed
  marks and the **Back to revision** presses (v2.8065). The Publish press never lets one be made.
- **Open** pressed again before a save lands draws the old row, for one round trip (v2.8066).
- A teammate's change in the moment between the press's read and the usual's own publish can still
  land (v2.8155). Each job's write names its draft's number, so it is refused and named.

## Part 3: builds ready now

None of these waits on a call. The mock-up draws the first three.

- **The tab's row chip** *A sheet on N of M jobs*. See #404, *Against the mock-up*.
- **The Sub NDA's Edit / Share switch.** Today the link's card and the GC send sit under the map.
- **The card of changed pages**: its counts, its legend, and an outline on the open cell.
- **The rest of the Sub NDA's words as fields.** Section names, fact labels, some of the flow's own
  words, the title, the job, the company and the party are not fields yet. See #404, step 7.
- **The GC send on Settings → What customers see**: a sample email and a sample page (v2.8151).
- **A refusal key of its own for *sent, not recorded*** in `document-builder-send`, on that
  function's next change. Keep the client's reader for the deployed function (v2.8096).

## Part 4: who opened a link, the same person twice

Today every open of a link is kept (v2.8187, v2.8194). An open by someone signed in names their
account. An open by someone with no account keeps the address it came from, the browser's name for
itself, and five details the page sends: language, time zone, screen, platform and touch
(`DOCUMENT_BUILDER_LINK_DEVICE_KEYS` in `supabase/functions/_shared/documentBuilderLink.ts`). Nothing
ties two opens together, so the card lists each open as its own line.

Taunya asked on 2026-11-21 what it would take to see that the same person looked twice. The answer
put to her, with nothing built:

| Way to tell | Catches | Misses |
|---|---|---|
| **A mark in the browser.** The link page makes a random id on the first open, keeps it in the browser and sends it with every open | The same browser coming back, for certain | A private window, cleared data, a second device |
| **A match on what is kept.** The same browser, language, time zone and screen | A return after the mark was lost | Two people in one office with the same phone read as one |
| **A fingerprint script** that reads how the device draws and which fonts it has | Some private windows | Safari, Firefox and Brave work against it. About half right unless a paid service does it, and it puts an outside script on a public page |

The pick put to her is the first two together, and not the third. No device ties a phone to a
laptop. Only a link for each person would, in part 5.

The build, once she answers the three calls under it:

1. **A drawing first.** The link card's **Who opened it** grouped into visitors, such as *Someone with
   no account · opened 3 times · first Nov 21, last Nov 23*. A match by mark reads as the same
   browser. A match by details reads *looks like the same device*. Draw it at 730 and 380 px.
2. **One column**, `document_builder_link_opens.visitor`, short text, null for a signed-in open.
   It ships alone and is pushed before any client sends it.
3. **The page and the function.** `src/lib/documentBuilder/linkIo.ts` makes and keeps the mark and
   sends it with the open. `document-builder-link` keeps it, cut to its own length, and answers the
   opens grouped. One deploy, on Taunya's go.
4. **The card and the guide.** The grouped list on `BuilderLinkCard.tsx`, and a line in the
   Document builder's guide.

Her three calls for it:

- **Across links or one link.** One mark for a browser shows the same visitor opening the sheets of
  two jobs. One mark a link shows repeat opens of that sheet only. The pick put to her: across links.
- **Telling the visitor.** The public page says that opens are noted. The pick: one plain line.
- **How long it is kept.** The same call as the address in part 5. A mark makes it matter more.

## Part 5: builds that wait on Taunya

Each line names the call. None is started.

- **Publishing the Sub NDA on prod, for walks 1g to 1i.** Its words are placeholders, and a publish
  cannot be taken back. It also wakes the one press to every GC with a page. The send session would
  wait for the attorney's read of the words first.
- **Whether to ask her insurance agent** if one certificate can ever cover several jobs. Step 6 is
  built one for each job. See #404, *Calls still open*.
- **How long an open is kept.** Nothing clears one today. Once she names a length, a daily clear or
  a clear that many days after the link ends.
- **An open of a link that is off is not kept.** Someone trying an old link leaves no trace. Keep it
  as *tried a closed link*, or leave it as it is.
- **A link for each person.** Each contact's email carries its own code, so an open names the
  contact. It is the only way to tie one person's phone to their laptop. It changes how a send
  makes links, so it is the biggest piece here.
- **Step 10, a GC sends their picks.** It waits on her yes. See #404, *Calls still open*.
- **The reason beside a dead press.** Today a dead second press says why on its row's chip or at the
  foot of the box, not beside itself (v2.8099).
- **Opening the tab to the office.** The tab is a dev's. See #404, *Who fills a job's sheet*.
- **The calls #404 built on their defaults** stand until she flips one. See #404, *Calls still open*.
- **Left out on purpose, build only if asked:** changing who a live send goes to in place (v2.8131),
  and keeping the agent's mark for every revision of the usual rather than the newest (v2.8142).
