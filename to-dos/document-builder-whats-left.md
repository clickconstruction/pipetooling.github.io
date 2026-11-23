---
name: "Document builder, what is left: the walks owed on prod, the builds left, and a way to tell one visitor from another"
number: 416
group: ready
status: written 2026-11-21 on Taunya's word, *save everything we should build, everything we didn't build and all of the walks we should do to a punch list card so another user on a different computer can pick up where we left off* · 2026-11-22 each walk given its page, its role, its test rows and its widths, and the loose ends named by PR, migration and row, on her word to record what is still owed on every card · the one home for the Document builder's leftovers · nothing on this card is started
summary: >
  The Document builder (#404) is built but for steps 6 and 10, and live for a dev. This card is the
  one list of what is left, in the order to do it. First the walks on prod that no one has done yet,
  each with its page, who to sign in as, the test rows, the widths and what should show. Then the
  loose ends: PRs not merged, a migration not pushed, the test rows the walks left. Then the builds
  that are ready now, a way to see that the same person opened a link twice, and the builds that
  wait on one of Taunya's calls.
next: Part 1, the walks, on test rows only. Walks 1g to 1i were walked on 2026-11-23 and hold. 1j can go now that PR #9337 is merged; it needs a file uploaded from the trade's page. Part 3 can start beside the walks. Parts 4 and 5 wait on Taunya's calls.
size: L as five parts (M · S · M · M · L), each alone
blocker: None for walks 1a to 1f, 1j and 1k. The Sub NDA was published as revision 1 on 2026-11-23, on the owner's go. Parts 4 and 5 wait on Taunya's calls, each named on its line. An attorney's read of the Sub NDA and an insurance agent's read of the sheet come before anything goes to a real GC or a real trade.
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
| Its insurance sheet | `document_builder_sheets`, revision 2 on the usual's revision 3 | `5e93b85f-4d69-4d6d-8990-858556dd81f0` |
| Its five trades | `gc_trade_packages`: Concrete, Plumbing, Electrical, HVAC, Fire sprinkler. None awarded | Concrete is `7c7a509d-187c-48fe-8dda-9a5fef720e23` |
| *GC test trade company, delete me* | Asked on Concrete, not awarded, its page on | `ff11d0fb-269e-44de-b92a-e7256c180f67` |
| *GC test bidding project, delete me* | `projects`, stage bidding, no sheet | `c4117b0d-0c64-4935-933f-01bd96bfef60` |
| *ZZ TEST GC On Notice* | `customers`, its page off | `1cd10f0f-04c3-410d-b34a-f0809e5240a5` |
| Its two ZZ TEST jobs | `jobs`, the GC on both is the customer above | `0e8dbf06-10bd-4288-a5fc-9be2740eaf5c`, `3426343e-77ea-4f23-a33c-ae74803fb361` |

**An address to send to.** Add a contact named `ZZ Test …` at `delivered+<label>@resend.dev`, the
mail provider's own sink, and pick it in **To**, since the company's main contact comes first. Delete
the contact after.

**Leave two rows as they are.** The usual insurance sheet (`document_builders` key `insurance`) is at
revision 3 with no agent's check. The Sub NDA (key `sub-nda`) is at revision 0, a draft never
published, at draft number 5 since the dev seat's walk of 2026-11-22. Publishing either is Taunya's.

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
  - **Publish revision 1** asks nothing first, though a publish cannot be taken back. Switching the link off asks.
  - Revision 1's words name the company *Acme Plumbing*, the placeholder, wherever the paper names us.
  - Once the ZZ TEST GC's page was on, the one press counted it among the GCs who are ready.
  - A GC's page can be turned off only from the portal globe, which shows for a job's customer. A GC that is no job's customer has no off switch within reach.
  - The send press names the contact by the first word of its name, *Send to ZZ*.
  - Removing a customer's contact asks nothing first.

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
- **Why not yet:** the screens, #9337, were in the merge queue on 2026-11-22 at 07:15 UTC. Nothing
  else holds the walk.

**1k. A link opened from a real phone** (v2.8194)

- **Where:** the insurance sheet's link card, as a dev. Then `/d/<code>` on a real phone, signed out.
- **Rows first:** the test sheet's link switched on for the walk and off after.
- **Should show:** the open listed under **Who opened it** with the phone's browser, and the sheet
  fitting the phone with no sideways scroll.
- **Why not yet:** every walk so far used a narrow desktop browser.

**Not walkable.** A link made under the service key before the link's own secret (v2.8189): prod held
no such link when the secret was set, and the tests hold that path.

## Part 2: loose ends

### In flight in another session

- **Step 6, a certificate checked against a job's sheet**, on Taunya's call of one certificate for
  each job. The send session owns these. If it is gone, they are the next person's.
  - The ground, v2.8253 (PR #9325), merged on 2026-11-22 at 07:06 UTC. Its migration
    `20261122021800_coi_checked_against_a_sheet.sql` was pushed alone and proven on prod: the seven
    `sheet_*` columns, the check, the index, and the two functions, callable by a signed-in person
    and not by anon. PR #9371 records the push on the migration's page.
  - The screens, PR #9337, were in the merge queue. No function is deployed for step 6. Its walk is 1j.
  - **The types are behind.** The push's type step failed for want of `node_modules`, so
    `src/types/database.ts` and the dev seat's catalog do not name the seven `sheet_*` columns. The
    client casts, so nothing breaks. A types PR folding only those names comes next, then `dev-mcp`
    deployed again for its catalog, on Taunya's go naming `dev-mcp`. Until then the dev seat cannot
    read those columns.

### What is pushed and deployed

- Every Document builder migration on main is pushed. The newest is step 6's `20261122021800`.
- `document-builder-link` and `document-builder-send` (version 5) and `gc-trade-portal` (version 184)
  were deployed from main on 2026-11-21 at 23:44 UTC. `customer-portal` was deployed the same day for
  step 9. No Document builder change on main has landed in a function since.
- `DOCUMENT_BUILDER_LINK_SECRET` is set on prod.
- `dev-mcp` runs 0.125.0, with v2.8257's paper-words verbs. It was deployed on 2026-11-22 at 06:13 UTC.

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

- **Send it again on the same day changes nothing on the row.** It still reads *Sent* with the same
  day, and how many times it went is not shown.
- **The GC card's held list runs long.** Under the one press it is one line for each GC with no page,
  which is most of them.
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
