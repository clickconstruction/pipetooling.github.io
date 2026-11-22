---
name: "Document builder, what is left: the walks owed on prod, the builds left, and a way to tell one visitor from another"
number: 416
group: ready
status: written 2026-11-21 on Taunya's word, *save everything we should build, everything we didn't build and all of the walks we should do to a punch list card so another user on a different computer can pick up where we left off* · card #404 holds the design and the record of what is built · nothing on this card is started
summary: >
  The Document builder (#404) is built through step 9 and live for a dev. What is left is spread
  over that card and a dozen release fragments. This card gathers it in one list, in the order to
  do it. First the walks on prod that no one has done yet, each with what it needs first. Then the
  builds that are ready now. Then the builds that wait on one of Taunya's calls, among them a way
  to see that the same person opened a link twice.
next: Part 1, the walks, on the test project only. Parts 2 and 3 can start beside it. Part 4 waits on Taunya's calls.
size: L as four parts (M · M · M · L), each alone
blocker: None for parts 1 to 3. Part 4 waits on Taunya's calls, each named on its line. An attorney's read of the Sub NDA and an insurance agent's read of the sheet still come before anything goes to a real GC or a real trade.
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
  is a placeholder. No clause wording goes in the repo.
- **Test rows only.** The bed on prod: the project *GC test project, delete me*, which has a
  published insurance sheet, and *GC test trade company, delete me*, asked and not awarded on its
  Concrete trade with its page on. A second project, being bid, has no sheet. Pick the job in the
  **Job** box at `/documents?tab=builder&builder=insurance`.
- **An address to send to.** Add a contact named `ZZ Test …` to the test trade company at
  `delivered+<label>@resend.dev`, the mail provider's own sink, and pick it in **To**. Delete it after.
- **Leave two things on prod as they are.** The usual insurance sheet is at revision 3 with no
  agent's check. The Sub NDA is a draft that was never published. Publishing either is Taunya's.
- **The dev server writes to prod.** There is no staging. A press that saves writes the live row.
- **Sign a browser in** with `node scripts/dev-pane-login.mjs` and open its link. Never type a
  password, and never print the link or a live link's code.
- **A dev cannot delete** a row of `document_builder_sends`, `gc_trade_messages` or the email log.
  Name what a walk leaves in its line on #404. A dev can delete a contact and a Sent copy.
- **Deploys and pushes** follow `CLAUDE.md`. A function deploy needs Taunya's go naming the function.

## Part 1: walks owed on prod

Each of these is built and on main, and each is held by tests. None has been seen on the live site.

| # | What to walk | Built in | What it needs first | What it should show |
|---|---|---|---|---|
| 1a | The one press with more than one trade | v2.8009, v2.8192 | A second test trade company, awarded on the test project | *Send to 2 trades who are ready*, both get it, and the asked trade listed as held |
| 1b | **Tell them it changed** | v2.8009 | A trade that opened the sheet, then a new revision of the test job's own sheet | *Changed since they opened it* on their row, and the press sends the note |
| 1c | A trade with no page | v2.8009 | A test trade company with no page | The row says so, and a send to them alone makes the page |
| 1d | A page that is off | v2.8009 | Turn the test trade's page off | The row says so, the send is dead, and **Turn their page on** is its own press. Turn it back on after |
| 1e | A lost or closed job in the job list | v2.8192 | Mark the bidding test project lost, then put it back | The job stays out of the list, or is marked when it has a published sheet, and the usual's publish holds it |
| 1f | A sent copy with a job | v2.8190 | A test project that bills through a job | The copy on Sent copies names that job, under *Contracts and estimates* |
| 1g | The Sub NDA's **Publish** and its attorney's mark | v2.8024 | Taunya's yes to publish the placeholder draft as revision 1 | Revision 1 published, the mark asks who read it, and a new revision reads unread |
| 1h | The Sub NDA's link | v2.8150 | 1g | Switch it on, open it signed out, walk to step 11 with no press on the last, switch it off, and read *This link is no longer open. Ask for a new one.* |
| 1i | Send the Sub NDA to a GC | v2.8151 | 1g, and a test customer who is the GC on a test job | The email, the block under that job on their page, and *Opened* on the office's row |
| 1j | A link opened from a real phone | v2.8194 | A phone, not a narrow browser | The open is listed under **Who opened it** with the phone's browser |

Not walkable, so nothing to do: a link made under the service key before the link's own secret
(v2.8189). Prod held no such link when the secret was set, and the tests hold that path.

## Part 2: builds ready now

None of these waits on a call. The mock-up draws the first three.

- **The tab's row chip** *A sheet on N of M jobs*. See #404, *Against the mock-up*.
- **The Sub NDA's Edit / Share switch.** Today the link's card and the GC send sit under the map.
- **The card of changed pages**: its counts, its legend, and an outline on the open cell.
- **The rest of the Sub NDA's words as fields.** Section names, fact labels, some of the flow's own
  words, the title, the job, the company and the party are not fields yet. See #404, step 7.
- **The GC send on Settings → What customers see**: a sample email and a sample page (v2.8151).
- **A refusal key of its own for *sent, not recorded*** in `document-builder-send`, on that
  function's next change. Keep the client's reader for the deployed function (v2.8096).

## Part 3: who opened a link, the same person twice

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
laptop. Only a link for each person would, in part 4.

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
- **How long it is kept.** The same call as the address in part 4. A mark makes it matter more.

## Part 4: builds that wait on Taunya

Each line names the call. None is started.

- **How long an open is kept.** Nothing clears one today. Once she names a length, a daily clear or
  a clear that many days after the link ends.
- **An open of a link that is off is not kept.** Someone trying an old link leaves no trace. Keep it
  as *tried a closed link*, or leave it as it is.
- **A link for each person.** Each contact's email carries its own code, so an open names the
  contact. It is the only way to tie one person's phone to their laptop. It changes how a send
  makes links, so it is the biggest piece here.
- **Step 6, a certificate held against a job's sheet.** It waits on *A certificate for each job, or one
  for each company*. See #404, step 6, and its calls table.
- **Step 10, a GC sends their picks.** It waits on her yes. See #404, *Calls still open*.
- **The reason beside a dead press.** Today a dead second press says why on its row's chip or at the
  foot of the box, not beside itself (v2.8099).
- **Opening the tab to the office.** The tab is a dev's. See #404, *Who fills a job's sheet*.
- **Left out on purpose, build only if asked:** changing who a live send goes to in place (v2.8131),
  and keeping the agent's mark for every revision of the usual rather than the newest (v2.8142).

## What the walks so far left on prod

Nothing here is owed. It is listed so a later walk is not surprised.

- The test sheet has eight links, all ended.
- Four rows of `document_builder_sends` to test addresses, every one taken off the trade's page.
- Three rows of `document_builder_link_opens`.
- Two older Sent copies from an earlier walk.
