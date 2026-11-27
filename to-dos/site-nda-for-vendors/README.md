---
name: "Site NDA for vendors: a paper names a job site, vendors sign before anything is sent, and the client is shown who signed"
number: 439
group: ready
status: asked 2026-11-24 · thought through with the owner the same day, each call settled as it came up · drawn as a canvas of sixteen artboards and reviewed as a whole · a door audit added eight doors to the plan · the word to build the whole train, testing along the way, with screenshots at several widths as each piece goes live · piece 1 built and seen live, v2.8520 · piece 2's list and answers built, v2.8529 · Fix the spelling and Open the job built, v2.8542, and seen live 2026-11-25 with nothing changed · the job form's question about an address at the same spot on the map built, v2.8640, which ends piece 2's build, seen live 2026-11-26 at desk width with no answer kept · piece 3's ground, four site columns on the paper's row, pushed 2026-11-26, v2.8642 · Send a paper names a site built, v2.8660, piece 3's first client part, seen live 2026-11-27 at desk width and at 375 px in dark, with nothing written · the site's papers on a job's Documents tab and on a company's own record built, v2.8665, not yet seen live · the Agreements view answers a paper's site, v2.8659, pushed 2026-11-26 · Find by site on the Agreements tab built, v2.8668, not yet seen live · the site's papers on the development's page built, v2.8669, not yet seen live · the box that prints the site's address built, v2.8676, piece 3's last part, its three functions deployed 2026-11-27, seen live the same day at desk width and at 375 px in dark, ticked and unticked with nothing sent, and the sample agreement page read with no word about a site · a paper's line says when it prints its address, v2.8691, and the Agreements view's fourth column was pushed 2026-11-27, the line not yet seen live since no paper names a site · piece 4 built in four PRs that wait: its ground #10019, a migration whose push is asked by name, and its three doors, the development's page #10020, a lone job's Documents tab #10027 and Send a paper #10031, each held behind that push, none seen live · 2026-11-25 (UTC) in the managing session: the four calls pieces 3 to 6 stood on were answered, each as the card picks, and the scrub of older public files was chosen, their history too, which waits on its own plan and a yes at the time
summary: >
  The company works for a client on a site whose details are secret. Vendors must sign the company's own
  NDA before anything about the site reaches them, and the client must be shown who signed. Today the app
  can send a vendor a paper and keep the signed copy. It cannot tie a paper to a site, it does not hold a
  send to a vendor who has not signed, and it has no proof to hand a client. This card adds a site to a
  paper, matched by address, with help for typing addresses the same way twice. The site's papers show on
  a job's Documents tab, on Documents → Agreements and on the development's page. Turning secrecy on for a
  site asks the company's own people to sign before a job there opens, and holds every send to an outside
  company until it signs. A packet, and later the client's own page, list everyone bound. Outside
  companies see a code name until they sign.
next: v2.8640's question at phone width and in dark, which the first look left. The live looks at v2.8665, the site's papers on a job and on a company's record, at phone and desk width. The live looks at v2.8668, Find by site on Agreements, and v2.8669, the development's page. One paper sent with a site and the box ticked, opened and signed, which stopped on 2026-11-27 before any write: the ZZ Test supply house has no one on file, so the walk needs a rep put on that house first, or an ask that names typing a signer. That walk is also the first sight of v2.8691's line. The three presses of the site's line at 375 px, which stood 32 px tall and are 44 in #10040. Then the push of piece 4's ground, `20261127052337_site_secrecy.sql` in #10019, asked by name, and its three doors in order, #10020, #10027 and #10031. Then the live look at **Secrecy on this site** on a ZZ Test development, on a ZZ Test job in no development and in Send a paper. Then piece 5, the proof, and the train in order, each tested and seen live before the next. Fix the spelling and Open the job were seen live on 2026-11-25 with nothing changed. Still owed on piece 2: an answer kept, in the list and in the job form, and a spelling changed, on a ZZ Test pair made for it.
size: L as a train of seven pieces, about fifteen PRs (S to M · M · M · M · S to M · M to L · M)
ask: counsel · read · Read the vendor NDA's wording before it is sent to a real vendor.
blocker: None for the build: the four calls pieces 3 to 6 stood on were answered on 2026-11-25. An attorney's read of the vendor NDA's wording comes before it is sent to a real vendor.
opinion: build — the signing, the gate and the Contract Book already exist; this ties them to a place and adds the hold and the proof
---

# Site NDA for vendors (#439)

The mock-up is [mockup.html](mockup.html), a static copy of the canvas, one artboard under the next.
The canvas itself is a private page: *Site NDA for vendors* — https://claude.ai/artifact/S8dZKCKk3rydaHo4H2ceDh.
The static copy was rendered once at 1400 px wide and every artboard's content fits its box. Nothing else
about it was checked in a browser.

## Made-up names only, and not legal advice

- The client, the site, the vendors and the code name behind this ask are private. **None of them goes in
  this card, a test, a fixture, a fragment, a release note, a commit, a PR or a picture.** Every name on
  the mock-up is made up, and every test and capture the build writes uses made-up names.
- The NDA's wording is the company's and an attorney's. No clause wording goes in the repo. The paper is a
  Contract Book paper with fixed words, entered through the app.
- Whether the client's own agreement lets the company share anything with a vendor, and on what terms, is
  for the client and an attorney. Nothing here answers that.

## The ask

2026-11-24, with the names left out on purpose. The company is doing work for a client on a very
secretive project. It needs a way in the app to coordinate with vendors about that project, with an NDA
signed first, and it must be able to show that NDA to the client.

Asked for along the way, the same day:

- The NDA names a job site. Whether that is a job or a development should not matter.
- Everything that matches the site shows the signed or pending NDA on the job window's Documents tab, on
  the Documents page and on the development's page.
- Sites match by address.
- While someone types an address on a new job or an edit, the form shows similar addresses already on
  file, so an address is not typed two ways.
- One pass over the addresses already on file, to see which jobs may share a place.
- Every new window has its door drawn with it.

## Settled, 2026-11-24

1. **The NDA is the company's own**, not the client's form. It is one-way: the vendor signs.
2. **Vendors** are supply houses plus the subs and trade companies the company brings to the site.
3. **The client gets a packet first**, a list plus the signed copies. Their own page comes after.
4. **The project's name is secret**, so an outside company sees a code name until it signs.
5. **Sites match by address.** The same cleaned address is a silent match. Close on the map but written
   differently shows as *looks like the same place*, answered once with **Same place** or **Not the
   same**. A development carries all its jobs.
6. **The paper may print the site's address.** That is counsel's call, so it is a box that starts
   unticked. Ticked, the signer reads the address before signing.
7. **Naming a site also requires the paper of the company's own people** on every job there, and each new
   one.
8. **The office and the estimator see the list.** The crew sees only their own paper.
9. **The list shows papers that exist.** A vendor with none appears when a send to them is held.
10. **One signature per site.**
11. **The office may turn secrecy on for a site**, the same roles that can require a paper on a job today.
12. **The door to *Addresses that look alike*** is the Pipeline's tools menu, under **Combine /
    Separate…**, with its count on the item and on the tools button.

Drawn and not objected to, each open to a flip:

- **Same place** records the match and changes no job's address. **Fix the spelling…** is a second press.
  Built on this pick in v2.8542, not yet answered.
- A sub counts as an outside company. *Our own people* means employees.
- No way around the hold is drawn. A held send goes by itself when the company signs.
- The hold reads the job or the bid a send is tagged to. A message with no job on it is not held.

## Answered, 2026-11-25

Four calls were put on 2026-11-25 (UTC) in the managing session, on question cards.
Each answer is quoted from that session's record of the user's answers, and each is the card's own pick.

1. *The paper prints the site's address only when a box is ticked, and the box starts unticked. Is that right?* "Yes, as the card picks". That is settled 6. Whether the address may be printed at all is still counsel's.
2. *A sub counts as an outside company, so a sub signs the site NDA like any vendor. Is that right?* "Yes, a sub is an outside company".
3. *There is no way around the hold. Is that right?* "Yes, no way around it".
4. *A held send goes by itself when the company signs. Is that right?* "Yes, it goes by itself".

**What they free.** Pieces 3 to 6 of the train are no longer held on these four.
**What they leave open.** Counsel's read of the NDA's wording, before a real vendor is sent it. The pick on **Same place**, built in v2.8542 and not yet answered. The pick that the hold reads the job or the bid a send is tagged to, which was not asked.

**Older public files.** Asked the same day *Older public files name the project and the client the site NDA is for. Should they be scrubbed?*, the answer was "Scrub history too", quoted from that session's record of the user's answers. It was chosen and nothing was done: no file was changed, nothing was removed, and no plan is written. A rewrite of a public repo's history waits on its own plan, brought to the user first, and on a yes at the time.

## What the one pass found

Read only, 2026-11-24, over 934 jobs. The table has real addresses and is kept outside the repo.

- 205 addresses are shared by two or more jobs. These match silently.
- 24 pairs are the same house number, a street written alike and the same spot on the map.
- 5 more are written alike where the map says apart.
- 22 pairs sit within 40 m and are written differently.
- 35 jobs have no street number and 7 are blank.

## What exists today

Read in the code on 2026-11-24. Check each again on the day.

- **Sending a paper to an outside party.** Documents → Agreements → **Send a paper** goes to a customer, a
  supply house, a trade company or a typed name (card #403). The signer gets a copy by email, a plain
  paper makes a PDF, and reminders go by email. The paper's row is `person_contract_documents`, which
  already has `job_id`, `party_contact_id`, `party_name` and `signing_for`. The send window does not ask
  for a job.
- **A company's papers already list** on the supply house form and the Customer page
  (`src/components/contracts/PartyPapers.tsx`, `src/lib/contracts/partyPapers.ts`).
- **The gate.** A job can require papers of everyone on it (`job_required_papers`, card #389). It is set
  one job at a time.
- **Addresses.** `jobs_ledger.job_address` is free text, and `bids.address` too. A development has a name
  and a city and no address (`developments`). `address_geocodes` keeps a map point for each cleaned
  address. `src/lib/developments/notInIt.ts` has `normalizeAddressKey`, the cleaning rule this card
  reuses. `src/lib/duplicateJobAddressGroups.ts` finds jobs at one exact address for **Combine /
  Separate…**.
- **The job form's address box** suggests addresses from Google only
  (`src/components/jobs/JobAddressSuggestions.tsx`, `src/lib/addressAutocomplete.ts`), nudges a missing
  comma and drops a pin.
- **Nothing holds a send.** No window checks a vendor's papers before it sends.

## The train

One PR at a time, each with its release note, fragment and guide, each tested, each seen live at phone
and desk width before the next is cut.

| # | Piece | What a person can do after it | Size | Touches |
|---|---|---|---|---|
| 1 | Addresses already on file (built, v2.8520) | On a new job or an edit, the address box lists addresses on file above Google's, with how many jobs are there. Leaving the box with an address close to one on file asks once. | S to M | One kernel for *same address*, the job form's box |
| 2 | The site match (the list, v2.8529; the fix, v2.8542; the job form's question, v2.8640) | **Addresses that look alike** from the Pipeline's tools menu: pairs to answer, **Fix the spelling…**, and jobs with no street number. Answers are kept. The job form asks **Is this the same place?** about a new address at a spot on file. | M | A table of answers, the window, the tools menu, the job form's box |
| 3 | A paper names a site (the columns, v2.8642; the send, v2.8660; the job's tab and a company's record, v2.8665; the view, v2.8659; Find by site on Agreements, v2.8668; the development's page, v2.8669; the box that prints the address, v2.8676; a line that says so, v2.8691) | **Send a paper** asks which site. The site's papers show on a job's Documents tab, on Agreements with a site filter, on the development's page and on a company's own record. A box prints the site's address for the signer. | M | A site on the paper's row, four lists, the signer's page |
| 4 | Secrecy on a site (the ground, #10019; the development's page, v2.8693; its other two doors in #10027 and #10031) | **Turn on secrecy for this site** from three doors. The company's own people sign before a job there opens. **Turn it off…** too. | M | A site's settings, the gate across a site's jobs |
| 5 | The proof (the list and Print, v2.8710) | **Make the packet** opens a window to look, then **Download**, **Print** and **Send to the client**. Later the client's own page shows the list, with a sample on What customers see. | S to M | A print, the customer portal |
| 6 | The hold | A send about a site's job or bid waits for a company that has not signed, says why, and offers **Send the NDA**. It goes by itself when they sign. A Needs you line and a notice tell the office. | M to L | Every window that sends to an outside company |
| 7 | The code name | Until a company signs, its emails, subject lines and pages carry the code name and nothing of the site. | M | The sends and the pages a vendor reads |

### The sends the hold must cover

Drawn for two: a quote request and a message. Read from the code, the rest are quote requests on a bid
(`RfqComposeModal`, `RfqNudge`, `RfqDeskModal`), a supply house's job account (`SupplyHouseShareModal`), a
bid's pricing package and room link (`PackageAndSendBidPricingModal`, `BidRoomPanel`), a submittal's room
link, asks to trade companies (`gc-trade-email`), sub papers (`SubPapersWindowConnected`), emailed
reports, and a purchase order printed for a supply house (`MaterialsPurchaseOrdersTab`). **A quote request
belongs to a bid, so the site match covers bids as well as jobs.** A Drive folder shared outside the app
is beyond any hold.

## Every door

The mock-up's first artboard lists each screen and where it opens from. Drawn: the Pipeline's tools menu
to the list of look-alikes, three doors to turning secrecy on, **Turn it off…**, **Take it back** on a
held send, and the links between the job, Agreements and the site's page. Still to add, each in its
piece: the **Fix the spelling…** window and **Open the job** on a no-number row (piece 2), a company's own
record with the site on each line and **Send the NDA**, the site picker on Agreements and the whole block
in a lone job's Documents tab (pieces 3 and 4), the packet's window and the sample on What customers see
(piece 5), and a Needs you line, a notice when a company signs, a chip in the development page's header
and the held state at every other send (piece 6).

## How to verify

- **Every piece.** Kernels first, each pure with its tests. Made-up names in every test, fixture and
  capture. A live look after the deploy at 375 px and 1200 px, in light and in dark where the screen has
  a dark side, with the captures kept for the owner.
- **Piece 1.** Seen live on 2026-11-24 at 375 px and 1200 px, as a dev, on a ZZ Test job's Edit tab, with
  the cursor in the address box and nothing typed. The row under **Already on file** shows above Google's
  with its count, and the line under the box says how many jobs and bids are there. Do not type there: the
  Edit tab saves the address by itself a moment after a keystroke, and leaving the box with an address the
  map does not hold looks it up and keeps the answer.
  The question about an address one letter off was seen live on 2026-11-24 at both widths, on the New Job
  form with a made-up address, so no job was written. The form was closed with **Discard**. Leaving the box
  kept one map-cache row under the made-up spelling, which nothing in the app removes.
- **Piece 2.** The answers' table was pushed on 2026-11-24. Seen live the same day at 375 px and 1200 px,
  as a dev, answering nothing: the count on the Pipeline's tools button, the item under **Combine /
  Separate…** with the same count, and the window with its line of counts and four tabs. Differing words are
  marked, a shared zip code is not, and nothing runs off the screen. **Same place**, **Not the same**,
  **Undo** and **Fix the spelling…** were not pressed live: each writes on a real pair.
  **Fix the spelling…** and **Open the job** (v2.8542) were seen live on 2026-11-25, as a dev, on three
  pairs, with no answer pressed and no address changed. The small window opens over the list with the
  two spellings and the first picked. Every job or bid written the other way is listed and ticked. The
  button counts its own ticks, **Change 1 address** to **Change 3 addresses**, and is dead as **Change
  addresses** with none ticked. A pair that differs by a unit carries the amber line that points at
  **Cancel** and **Not the same**. Escape closes the small window alone and the list stays.
  Under **No street number**, each row's press is 44 px high and reads **Open the job** or the job's
  number. It opens the job over the list on its Edit tab with a blue ring on the Job Address box and
  nothing focused. Escape closes the job alone.
  Not seen: **Same place**, **Not the same** and **Change N addresses** pressed, a row that fails, the
  toast with both counts, and a pair leaving the list after a fix. Those need a ZZ Test pair made for
  the look, and that is a write on its own yes.
  The job form's question (v2.8640) was seen live on 2026-11-26, 18:10 to 18:13 UTC, as a dev, at desk width, on the New
  Job form with the ZZ Test jobs' street line and a made-up unit. The amber box **Is this the same place?** shows after
  the box is left, with the count and the address on file in bold, both spellings with the differing words marked, and
  three presses 44 px high. It goes while the cursor is in the box and comes back after. **Same place, use that
  spelling** took the address on file and wrote nothing. The form was closed with **Discard**. The look kept one
  map-cache row under the made-up spelling, which was cleared from Settings the same sitting.
  Not seen: **Same place, keep mine** and **Not the same** pressed, since each writes one answer and neither has a yes;
  375 px and dark; and **Create Job** live beside the question, since the name was blank.
  The dropdown lists an address on file while its street line is typed, and no longer once a unit it does not have is
  typed. That is piece 1's rule and the look read it so.
- **Piece 3, the send (v2.8660).** Not seen live. To read it without a write: Documents → Agreements, **Send a paper**, a paper, a supply house, then in the email window **Name a site…**, an address on file, and close every window with nothing sent. Nothing is written before **Send email**. A send that names a site is a write and an email, so it waits on its own yes, a ZZ Test supply house with a sink address and a ZZ Test paper.
- **Piece 3, the two lists (v2.8665).** Not seen live. Both read only. Until a paper names a site on prod, a job's Documents tab shows no **Papers for this site** and no company's line says a site, so the look reads that nothing changed. The lists themselves are read after the ZZ Test send of v2.8660's look.
- **Piece 3, Find by site (v2.8668).** Not seen live. It reads only: **Find by site…** on Documents → Agreements, an address on file, and the list is asked for that site's papers. Until a paper names a site on prod the list comes back empty with **Clear the filters**, which is the right answer and reads so.
- **Piece 3, the development's page (v2.8669).** Not seen live. It reads only. Until a paper names a site on prod, no development's page shows **Papers for this site**, and the look reads that the page is as it was.
- **Piece 3, the box that prints the address (v2.8676).** Not seen live. Read on a scratch page in the worktree at 375 px and 1200 px, in light and in dark, with every request answered from the page: the box under a named site, off, ticked and held, and the signer's page with and without the line. Until `get-contract-for-signer` is deployed the box is dead and says the signer's page cannot show an address yet, which is the right answer and reads so. After the three deploys the box can be read live without a write: name a site, tick the box, read the words under it, and close every window with nothing sent. A signer's page that shows the line needs a ZZ Test paper sent with the box ticked, which is a write and an email on its own yes.
- **Piece 3, the line that says a paper prints its address (v2.8691).** Not seen live. A company's own list was read on a scratch page in the worktree at 375 px and 1200 px, before and after. Until a paper is sent with the box ticked, no line on prod says *printed on the paper*, and every list reads as it did. On Documents → Agreements the words wait for the push of `20261127050501_agreements_on_file_site_print.sql`: before it the list reads again without the column and says nothing of a print.
- **Pieces 3 to 7.** ZZ Test jobs, a ZZ Test supply house with a sink address, and a ZZ Test paper only.
  Nothing goes to a real vendor before an attorney has read the wording.
