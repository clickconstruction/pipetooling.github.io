---
name: "Legal desk: affidavits from the desk — the thinking, the window and the print faces"
number: 220
group: close
status: card and mock-up 2026-10-30 · the owner's answers written in the same day (notaries on staff, in person only, Guadalupe County, any team member swears, the 902(10) preset wanted) · PR 1 the kernel v2.6208 · PR 2 the migration v2.6209 · PR 3 the window v2.6210 · PR 4 the print faces v2.6211 · PR 5 filing the scan v2.6212 · PR 6 the business-records preset v2.6213 · all six built 2026-10-31 · PR 7 the affiant's full name v2.6238 (claude/220-affidavit-full-name), from the live walk · PR 8 a declaration names its signer one way v2.6243 (claude/220-affidavit-one-name), from the live screenshots · PR 9 the robot path v2.6244 (claude/220-mcp-statement-verbs-ce4096): dev-mcp `plan_matter_statement` / `apply_matter_statement`
mockup: to-dos/legal-desk-affidavits/mockup.html
summary: >
  The office made one affidavit by hand this month: drafted in a chat, exported, printed, driven to a
  notary, scanned, uploaded to Evidence with a title and a line, typed onto the Timeline as a done step,
  and written into the narrative again. Nine steps across four tools, and a date in it was wrong, so a
  second one is being drafted by hand. One window on the Legal desk does the same in four presses: type
  the statement with its title, who swears it, the day it is about and the county it is signed in; pick
  how it is signed, before a notary or under penalty of perjury with no notary; print the paper, the
  statement alone, or the signing page alone to staple on a handwritten statement; file the signed scan
  and confirm the two days. The text lands on the Timeline's Said lane, the scan on Evidence, linked.
next: the merges in order, then the push and the portal deploy, then the owner's look at a live account; after PR 2 merges, `supabase db push` and `supabase functions deploy legal-portal` (PR 3's client calls the RPCs, so the push comes before its deploy). Question 3 (drafts to counsel) is still open and the default follows the everything-goes rule until the owner says otherwise.
size: M as a train of six (S · S · M · S · M · S)
blocker: None. The owner answered 2026-10-30; the one open question (drafts to counsel) changes no PR before 5.
opinion: build as recommended with the owner's defaults — before a notary for everyone, Guadalupe County on the venue line, blank one tap away; the one design call still open is whether the firm reads a draft before the witness signs
---

# Legal desk: affidavits from the desk (#220)

## The ask

The owner, 2026-10-30, after the office made an affidavit by hand for a live collections account:

> In the legal desk for our team, I would like to be able to open a modal for producing affidavits that is designed
> around being able to 1) type up an affidavit and select what needs to go in it such as what county and state, and
> set the title, and who is claiming they said it, and on what date; 2) be able to easily print that affidavit from
> the modal; 3) be able to upload the scanned affidavit and confirm the date of incident. This way we can have that
> text be on the timeline and the file stored in the evidence folder. If we go to hand this to a witness and they say
> they don't like a sentence we may need to be able to quickly revise it, or ask them to write out what they want and
> be able to attach a jurat on top of it, so we need to make it easy to select to print with jurat. Help me think
> deeply through this and come up with a solution to add.

## The thinking

Each question below has an answer and the reason. The mock-up draws the answers; the plan builds them.

### Who the affiant is

Three people swear statements on a collections account, and the window serves two of them now:

1. **One of our team** — generally the responsible master plumber, but any team member who heard or saw something: a
   tech who was on site, the office person who sent or received a paper (the owner, 2026-10-30). The office knows the
   facts from the clock, the field reports and the job thread, so the office drafts and the affiant reads. The opener
   names the role: *I am the Responsible Master Plumber of record for Click Plumbing and Electrical, License No. …*
   Picked from the team roster, every team member listed with the RMP first; the role line prefills from it and can be
   edited.
2. **A third-party witness** — a neighbour, a supplier's driver, another trade's foreman, the GC's own worker. The
   office drafts from the witness's words, or the witness writes it out by hand and the office prints the signing page
   alone to staple on top. The opener says who they are in one line and that they have no stake: *I am the foreman for
   Brightline Electric, the electrical subcontractor on the job. I have no interest in the outcome of this dispute.*
   Typed, not picked.
3. **The office as custodian of records** — the business-records affidavit (Tex. R. Evid. 902(10)) the firm will ask
   for to put the invoices and the clock into evidence without a witness. Its words are a prescribed form, not a
   statement, so it is a later preset on the same window, not this card.

Whose paper it is on Evidence (`legal_matter_documents.whose`, v2.6108): a team member's or a neighbour's affidavit is
**our record** (null, the existing title guess already lands *affidavit* there); a supplier's person's is **the
supplier's**. No new kind. The window shows the pick with the default set, as the add-a-paper form does.

### Two Texas forms, and when each fits

A statement a court will read comes in two forms in Texas, and the window offers both as one choice, *How it is
signed*, made once per draft. The words are quoted in the mock-up from the statute and the Secretary of State's forms,
not from memory.

**Before a notary (an affidavit with a jurat).** Tex. Gov't Code § 312.011(1): *"Affidavit" means a statement in
writing of a fact or facts signed by the party making it, sworn to before an officer authorized to administer oaths,
and officially certified to by the officer under his seal of office.* The certificate is the jurat, in the Secretary of
State's sample form (Sept 2019): *State of Texas · County of ___ · Sworn to and subscribed before me on the ___ day of
___, (year), by (name of signer). · (Personalized Seal) · Notary Public's Signature.* The seal itself carries the
notary's name, ID number and commission expiry (§ 406.013(a)), so the printed block needs the signature line and room
for the seal; a printed-name line and a *My commission expires* line are a courtesy the notary fills. The Lien desk
already prints exactly these words under the § 53.054 lien affidavit (`lienFilingDocuments.ts`); the kernel lifts them
so both papers read one jurat. The hand-made affidavit also opened with the long *BEFORE ME, the undersigned notary
public, on this day personally appeared …* paragraph. The jurat at the end is what makes the paper an affidavit; the
opener is belt and braces and a quarter page on a phone, so the window's default opener is the short one:
*My name is …. I am over eighteen years of age, of sound mind, and capable of making this affidavit. The facts stated
in it are within my personal knowledge and are true and correct.*

**Under penalty of perjury, no notary (an unsworn declaration).** Tex. Civ. Prac. & Rem. Code § 132.001(a): *an
unsworn declaration may be used in lieu of a written sworn declaration, verification, certification, oath, or
affidavit required by statute or required by a rule, order, or requirement adopted as provided by law.* It must be in
writing and *subscribed by the person making the declaration as true under penalty of perjury* (c), and carry the
jurat in (d), quoted whole in the mock-up: the declarant's first, middle and last name, date of birth, street address,
city, state, zip and country, then *I declare under penalty of perjury that the foregoing is true and correct.
Executed in ___ County, State of ___, on the ___ day of ___, ___.* The perjury statute reaches it the same way it
reaches an oath (Tex. Penal Code § 37.02).

**When each fits, in the window's own words:** *A notary is a trip. The declaration is a signature. A court reads
both. Only a paper the county clerk files needs the notary.* That last sentence is § 132.001(b): the declaration does
not serve *a lien required to be filed with a county clerk* or *an instrument concerning real or personal property
required to be filed with a county clerk*, so the § 53.054 lien affidavit stays a notarized paper on the Lien desk,
and this window never offers the declaration for it. The declaration fits a witness in the field who will sign now
and never make a notary appointment, and a team member's statement that would otherwise wait a week. The notary fits a
statement the firm wants to carry the most weight, and anything signed at the office when a notary is there. The office
has notaries on staff (Paige Bloomer among them) and signs everything in person: the paper is printed, signed before
the notary, scanned and uploaded (the owner, 2026-10-30). A notary is no trip here, so the default is **before a
notary** for a team member and for a third-party witness alike; one tap changes it to **no notary** for a witness in the
field who will sign now and never come by, and the body's opener and the signing block change with it. No remote
online notarization: the jurat's words stay the in-person ones. The declaration puts the declarant's date of birth and home address on
the paper. They are typed at print time, held in the window for the session so a reprint after an edit does not ask
again, and **never saved**: not in the entry, not on the Timeline, not in the Evidence row's line. The signed scan
carries them, as it must.

### Two dates

- **The day it is about** (the incident day): typed when drafting, required, with an optional *to* day for a span
  (*Sept 3 to Sept 17*). It is where the statement sits on the Timeline.
- **The day it is signed**: never typed while drafting. The printed jurat and the printed declaration carry blanks
  (*on the ___ day of ___, ___*) the notary or the declarant fills by hand, so the paper is right whatever day the
  signing happens. The office types it when it files the scan, reading it off the jurat, and confirms the incident day
  on the same sheet. The Evidence row's `dated_on` is the signing day; the Timeline's Said item is the incident day with
  *Sworn Oct 29* in its state words.

The hand-made affidavit swore to a date the City's record contradicted, and a supplemental affidavit is now being
drafted by hand to fix it. The window shows, beside the incident day, **what the record says about those days**: the
affiant's approved clock sessions on the job, the field reports and the job-thread notes dated inside the span, each a
line with its day. A statement that says *August 10* while the clock says *August 11* is caught before anyone swears.

### The venue line

*State of Texas, County of ___* at the top of the jurat is where the affiant stands when the notary watches the
signing, not where the job is. **Guadalupe County** is the default for a notarized paper: the overwhelming majority are
sworn there, before the office's own notary (the owner, 2026-10-30). The window says so in plain words under the pick:
*Where the notary watches the signing. Not where the job is.* *Leave it blank for the notary* is the second pick,
because the hand-made one was sworn in the affiant's home county, not the office's, and a paper signed elsewhere is
right when the notary writes the county in by hand. The property's county is the third, for a signing on site. The declaration's *Executed in ___ County* is where the declarant
signs, so its default is the property's county, since the point of the form is a signature in the field.

The office's county is not in the app today (`PORTAL_COMPANY` carries a name, a phone and a tagline). PR 2's migration
seeds one company setting (`app_settings.office_county` = *Guadalupe*) and PR 3 shows it in Settings for the day it
changes; the pick never waits on a typed value.

### The field flow, and how many presses

The office drafts at a desk, prints, hands the paper to the witness. Three things happen in the field, and each is
counted from an open desk on the phone:

| In the field | Presses | How |
| --- | --- | --- |
| Print the draft as it stands | Evidence tab → the draft's row → **Print** → the phone's print sheet | 4 |
| The witness dislikes a sentence | open the draft → edit the sentence → **Print** → print sheet | 4 |
| The witness wrote their own | open the draft → **Print ▾** → *The signing page alone* → print sheet | 4 |

The print is a split button. **Print** prints the whole paper as the draft is set (the statement with its jurat, or
with its declaration block). **▾** opens three faces: *The whole paper*, *The statement alone* (to read over together,
no signing block), *The signing page alone* (the jurat or the declaration block, to staple on a handwritten statement).
The form was picked once at the top, so there are three faces, not five. The owner's four — with jurat, alone, jurat
only, unsworn declaration — are these three under each of the two forms.

The signing page alone is never a loose jurat. It names what it is attached to: *This jurat is attached to the
handwritten statement of T. Nguyen, ___ pages, each initialed by the signer.* A notary will not sign a jurat that
floats, and a court should not have to guess.

The paper draws **inside the window** on a light sheet (the lien papers' own print page in a frame) and **Print** calls the
frame's print, on every device (built so in PR 4: one path, and the desktop sees the page before its print dialog; the card
had kept the lien papers' new tab for the desktop). Nothing opens a new tab: Safari's popup rule blocked the Lien desk's
`window.open` print on phones more than once. From the print sheet, AirPrint prints it or *Save to Files* makes the PDF;
**Save as PDF** beside Print makes the file outright, to text or AirDrop.

### Revisions: drafts are kept, each print is noted, the scan closes it

A statement is one row with a state: **draft → printed → signed**. Every edit saves the text. Every print appends
`{ at, by, face, text }` to the row's print log, so the record shows what was handed over and when; the text is kept
with it because the sentence the witness refused is the one the firm may ask about. The Timeline shows **one line**
for the statement, not one per print — five prints while a witness reads over a shoulder would bury the day — and the
line's chip reads *draft · not signed* or *printed twice · last Oct 28*, with the print log behind its ⋯.

Filing the scan asks one more question: *Is the signed paper the text as last printed?* **Yes, as printed** marks that
print's text as the sworn text. **They changed it by hand** keeps the entry's text as printed, marks it *see the scan
for hand changes*, and the scan governs. A draft nobody signs stays a draft chip on the Timeline, amber after fourteen
days (*printed 14 days ago · no signed copy*), listed in the Evidence tab's **Sworn statements** strip above the documents
(built so in PR 3: a strip of its own in place of the card's draft rows under the **Drafts** filter, so a draft never
pretends to be a document and the filters stay the documents'); **Not signed…**
voids it with a reason the Timeline reads as *Undone: would not sign the September paragraph.*

### Where it lands

- **The text** is a `legal_matter_entries` row of a new kind, **`statement`**, in the Timeline's **Said** lane on the
  incident day (`occurred_on`). `body` is the statement; `meta` is `{ title, affiant: { kind: team | witness, user_id,
  name, role }, form: notary | declaration, incident_to, venue_county, state: draft | printed | signed, prints: [...],
  signed_on, document_id, source }`. The kind joins the CHECK (v4), the office writes it through `legal_statement_add`
  / `legal_statement_update` (the plan RPCs' shape, caps on body and meta), and it is held from counsel under
  `statement:<id>` like a plan or an event. The firm's Timeline draws it in the Said lane with the chip *sworn
  statement* or *declaration*, and its `kind` words join `firmEntryKindWords`. The portal already ships every entry
  kind except the held ones, so the text reaches the firm with no new column.
- **The scan** is a `legal_matter_documents` row through the same path the Evidence tab's add press uses
  (`addLegalMatterDocument`): title = the affidavit's title, `shows` = *Sworn Oct 29 before a notary in Travis County.*
  plus the office's one line, `dated_on` = the signing day, `state` final, `whose` as picked. The entry's
  `meta.document_id` points at it; the row's ⋯ gains *The statement on the Timeline* by looking the entry up.
- **Not in the document row:** the text. `shows` is one line and the firm reads the whole statement on its Timeline
  from the entry; a `text` column would be a second copy that drifts. The narrative gets *Insert the statements*
  beside *Insert the events* later, the same way.

### What the office did by hand this month, and what the window saves

Read from the case folder's notes and the desk's own filing plan, in order: the statement was drafted in a chat as a
numbered-paragraph paper with a Texas venue caption and a jurat (and the hand-written note that it *can be switched
back to an unsworn declaration if no notary*); exported to PDF; printed; the affiant drove to a notary in his home
county and signed; the scan was uploaded to Evidence with a title and a *shows* line; a Timeline step dated the signing
day was typed and marked done (*signed his affidavit before a notary in … County*); the narrative was edited to say
the same; and because a date in it disagreed with a public record read four days later, a supplemental affidavit is
being drafted in a word processor with two brackets only the affiant can fill. The window does the first seven as one
row with three states, and the record check beside the incident day is what would have caught the date.

### Reuse

- **The jurat words** and the print HTML: `lienFilingDocuments.ts` (`STATE OF TEXAS / COUNTY OF … / SWORN TO AND
  SUBSCRIBED BEFORE ME on this ___ day of …, by …`), `filingDocPrintHtml`, the `data-theme="light"` paper wrapper in
  `LienFilingTabs.tsx`; the new kernel exports `juratBlock()` and the lien print adopts it in the same PR so one test
  pins both.
- **The sheet on the desk**: `AccountWriteDownPanel.tsx` — a panel inside the desk whose Save button says what it
  does; `legalDeskShared.tsx` (`btn`, `sheetInput`, `Door`, `SectionTitle`).
- **The upload**: `LegalMatterDocumentsPanel.tsx` → `addLegalMatterDocument` (title, shows, dated_on, state, whose),
  `legalDocumentProblem` for the file rules (PDF or image, 10 MB).
- **The composer**: `LegalTimelinePanel.tsx`'s `ComposerForm` — its kind tag gains *a statement*, which opens the
  window on the day typed; `legalPaperNextDoor.ts` is the pattern for a door that opens another surface.
- **The words**: `plainWords.ts` for every helper line a first-timer reads; `confirmLabel` on *Not signed…* (*Drop the
  draft*); `formatErrorMessage` on every failure; `EmptyState` for the Said lane's empty words, which gain *Swear a
  statement*.
- **The record check**: `useLegalPacketData.ts` already loads the account's clock sessions, reports and thread notes
  for the Evidence tab's job table; the window filters them to the affiant and the span.

### The robot path

dev-mcp's `plan_matter_document` / `apply_matter_document` (v2.6004) files the scan and is enough for the paper. The
text is not a document: `shows` is one line, and a statement is pages. Built after the train (PR 8, v2.6244, server
0.13.0): `plan_matter_statement` / `apply_matter_statement` over `dev_legal_statement_write` (migration
`20261031190000`), the twentieth and twenty-first write verbs. A robot drafts an affidavit or an unsworn declaration
onto the matter's Timeline — the day it is about and the span, the title, who swears it by `users.id` with their full
name as it reads on their ID (or a witness typed in), the form, the county, the paragraphs — and may change a draft it
or the office made until the signed copy is filed; the plan commits to the draft as it would be written and the
matter's live statement count, and apply writes through `legal_statement_add` / `_update` with `source = 'mcp'`, so
the Said lane's chip reads *· dev MCP*. The office prints, signs and files it from the window as before; the robot
never prints, signs or files, and `plan_matter_document` still files the scan. Deploy: push the migration, then
`supabase functions deploy dev-mcp`.

## The recommendation

Build the window as drawn, in five small PRs, with these calls made:

1. Two forms, picked once (*Before a notary* · *No notary, under penalty of perjury*), three print faces under each.
2. The text as a `statement` entry in the Said lane on the incident day; the scan as a document on the signing day;
   linked by id; the firm reads both; drafts travel as drafts with a loud chip, held from counsel on request.
3. The signing day is never pre-printed; it is read off the scan at filing.
4. The venue county defaults to the office's county for a notary and the property's county for a declaration, with
   *blank for the notary* always offered, and plain words saying which is which.
5. The record check beside the incident day: the affiant's clock days, reports and notes in the span.
6. The declarant's date of birth and address are printed, never saved.
7. On the phone the paper draws in the window and prints from it; no popup.

## The mock-up and its second pass

`mockup.html` draws, on the invented Northline Builders account (job 742, Quick Lube, Cedar Park; our RMP D. Alvarez;
the witness T. Nguyen of Brightline Electric; the firm Hale & Rowe; today Fri, Oct 30, 2026): the nine hand steps
beside the four presses; the window drafting at desk width with the record check; the print sheet and the three
printed faces under each form, with the statute words quoted; the field flow at phone width (the sentence edited, the
signing page alone); filing the scan; the Timeline line and the Evidence row it leaves, on the desk and as the firm
reads them. The blue *Second pass* box under each section says what the first render showed and what changed.

## Where it plugs in

- The desk: `src/components/jobs/legal/LegalDesk.tsx` (tabs, windows at `DESK_LAYER_Z`), `LegalDeskPacketTab.tsx`
  (the Evidence tab mounts `LegalMatterDocumentsPanel`; the door *Swear a statement…* goes beside **Choose files**),
  `LegalTimelinePanel.tsx` (the Said lane, the composer, the row's chips and ⋯).
- The kernels: `src/lib/legal/legalTimeline.ts` (lanes, items, state words), `legalMatterDocuments.ts` (the Evidence
  row's words, `whose`), `legalAsks.ts` / `legalFirmWords.ts` (kind words for the office and the firm),
  `src/lib/jobsDocuments/lienFilingDocuments.ts` (the jurat and the print HTML), `printWindow.ts`.
- The data: `legal_matter_entries` (kind CHECK v3 in `20261025120000_legal_matter_events.sql`; the plan RPCs in
  `20261023195135_legal_plan_items.sql` are the shape), `legal_matter_documents` and the `legal-matter-documents`
  bucket, `app_settings` for the office county.
- The firm: `supabase/functions/legal-portal/index.ts` ships entries by kind minus the held (`statement:<id>` joins
  `plan:` / `event:` / `offer:`), `_shared/legalMatterDocuments.ts` for the row.
- The robot: `supabase/functions/dev-mcp/` and `_shared/devMcpWrites.ts` (the verb pair, PR 8, v2.6244).

## The plan

| PR | What | Size |
| --- | --- | --- |
| 1 | **Kernel** `src/lib/legal/affidavitPaper.ts`: the opener for a team member and for a witness, the jurat (lifted from the lien print, which adopts it), the § 132.001(d) block verbatim, the *attached to* line for the signing page alone, the three faces as print blocks → `filingDocPrintHtml`; `statementDraftProblem`, the state words (*draft · not signed*, *printed twice · last Oct 28*, *Sworn Oct 29 before a notary in Travis County*), the fourteen-day amber. Tests pin the statute words character for character and every face under each form. No screen. | S |
| 2 | **Migration**: kind `statement` on `legal_matter_entries` (CHECK v4, `SET lock_timeout = '3s'`), `legal_statement_add` / `legal_statement_update` (office roles, body cap 20,000, meta shape checked, the print log append-only, `source` office or mcp), `legal_statement_void`; `app_settings.office_county`. `docs/migrations/` doc; types regen; the portal and `buildLegalTimeline` learn the kind in the Said lane for both readers; `firmEntryKindWords`. | S |
| 3 | **The window** `LegalAffidavitWindow.tsx`: title, affiant (roster pick or typed witness with role line), the day it is about with *to*, *How it is signed*, the county with the three picks and the plain words, the statement box, the record check, **Save the draft**; doors from the Evidence tab and the composer's kind tag; the Timeline line with the draft chip and ⋯ (Edit, Print, Not signed…); the Drafts filter counts it; Settings gets the office county. Help guide `swear-a-statement-on-a-collections-account.md` ships here and grows with 4 and 5. | M |
| 4 | **The print faces**: the split button, the three faces, the paper drawn in the window on a light sheet with a print stylesheet, the print log appended at each print, the desktop's new tab kept; the declarant's details asked at print time and held for the session only. | S |
| 5 | **Filing the scan**: **File the signed copy…** on the draft's row and in the window: drop or choose the scan, confirm the incident day, type the signing day off the jurat, *as printed* or *changed by hand*, `whose`; the document row through `addLegalMatterDocument`, the entry → signed with `document_id`; the Evidence row's ⋯ *The statement on the Timeline*; the firm's Evidence and Timeline read both. `PROJECT_DOCUMENTATION.md` / `GLOSSARY.md` for the window. | M |

| 6 | **The business-records affidavit** as a preset on the same window (Tex. R. Evid. 902(10), the form in 902(10)(B) quoted verbatim): the office as custodian of records, the affiant picked from the roster, the records named by their Evidence rows (the invoices, the clock, the job thread) with the row count and page count the form asks for; printed and filed through PRs 4 and 5 unchanged. Wanted by the owner (2026-10-30) if it adds value: it is what lets the firm put our invoices and the clock into evidence without calling anyone to testify, and the firm asks for it on every account that reaches suit. | S |

Built after the train: dev-mcp `plan_matter_statement` / `apply_matter_statement` (PR 8, v2.6244). Later: *Insert
the statements* in the narrative. Not wanted: remote online notarization — the office signs everything in person (the owner, 2026-10-30).

## How to verify

A collections account on the dev server (`/legal-desk`, the dev signed in), Evidence tab → **Swear a statement…**:
pick a team member, type a day inside the job's clock days and watch the record check list the sessions; type three
paragraphs; **Print ▾** shows three faces and the whole paper prints with the jurat's blanks empty and the office's
county on the venue line; switch to *No notary* and the opener, the block and the county default change; print *The
signing page alone* and read the *attached to* line. Save; the Timeline's Said lane shows the draft chip on the
incident day and the Drafts filter counts one. **File the signed copy…** with any PDF: the Evidence row sits on the
signing day under *Our record* with the sworn line, the Timeline item reads *Sworn … before a notary in … County*, and
*Preview what the firm sees* shows both. On a phone-width tab, the window fills the screen and **Print** opens the
browser's print sheet with the app hidden. `npx vitest run src/lib/legal src/components/jobs/legal` after each PR, and
`grep -rl lienFilingDocuments src --include='*.test.ts*'` for PR 1's jurat lift.

## The owner's answers (2026-10-30)

1. **The notary.** Staff notaries, Paige Bloomer among them. No digital notaries: everything signed is signed in person,
   printed, then scanned and re-uploaded. → Default **before a notary** for every affiant; the declaration one tap away;
   no remote online notarization.
2. **Who swears.** Generally the RMP, but any team member on the project who heard or saw something. → The roster pick
   lists every team member, the RMP first. (The question as asked — whether the firm would settle for a declaration —
   falls away: with a notary on staff the sworn form costs nothing.)
3. **Drafts to counsel.** Not answered. → The default follows the desk's rule since 2026-10-05: everything goes to
   counsel unless the office holds it, so a draft travels with its loud *draft · not signed* chip and *Hold from counsel*
   on its ⋯ keeps it home. One sentence from the owner flips the default to signed-only; it changes PR 2's portal line
   and nothing before it.
4. **The county.** Guadalupe County, Texas, for the overwhelming majority; blank must stay an option for the notary to
   fill when the paper is signed elsewhere. → Guadalupe seeded as the office county; *Leave it blank for the notary* the
   second pick; the property's county the third. The affiant's last county is not offered.
5. **The business-records affidavit.** The owner is not sure how it would be used but wants it if it adds value. → PR 6,
   after the train, as a preset; its value is in the plan row.

## Where it stands

Built in six PRs on 2026-10-31 (v2.6208–v2.6213), each on its own `claude/220-affidavit-*` branch and stacked until the
one before it merges: the kernel and the shared jurat; the migration, the RPCs, the Said lane and the office county;
the window, its doors and the record check; the print sheet with the three faces and Save as PDF; filing the signed
scan with the two links; the business-records preset (Tex. R. Evid. 902(10)(B), quoted from the Supreme Court's order
of 2014-08-19). Left after the merges: `supabase db push`, `supabase functions deploy legal-portal`, the owner's look on a
live account. The robot path landed after the train as PR 8 (v2.6244): dev-mcp `plan_matter_statement` /
`apply_matter_statement` over `dev_legal_statement_write`, waiting on `supabase db push` and `supabase functions
deploy dev-mcp` after its merge. Later: *Insert the statements* in the narrative. Question 3 (drafts to counsel) stays answered by the desk's rule until the owner says
otherwise.
