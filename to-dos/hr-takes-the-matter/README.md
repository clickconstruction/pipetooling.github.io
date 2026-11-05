---
name: "The HR file carries a person's matter whole: linked files of any size, a custody hash, themes on the record with a By theme investigation, a matter on a person, and a counsel-only hold"
number: 269
group: ready
status: planned 2026-11-05 · building on claude/* branches from the same session, one PR a step
summary: >
  The owner asked whether People → HR could take on a former teammate's case folder: an analysis
  for counsel, forty-odd exhibits, two dozen call recordings and a privileged subset. The HR file
  holds the dated facts and the small exhibits today. It cannot hold a file over 10 MB, it has one
  privacy tier so the agent seat and Drive see every record, the analysis has no home because a
  Legal desk matter stands on a Collections payer rather than a person, and nothing lets the office
  find a pattern again across a large record. Four pieces, ten small PRs: a linked file on an
  evidence record (a Drive link in place of bytes) with a sha256 on every attachment; a matter kind
  that stands on a person, with the desk's Account and Paper tabs absent and a Matter door on the
  HR file; themes, plain-words names for a pattern marked on entries, evidence, documents and
  events, with a By theme view where one theme's items open in a window over the list; and a
  counsel-only flag that keeps a record out of Drive and out of the agent seat, with its limit
  stated.
next: PR 1a the linked file; then 1b, 3a, 3b, T1, T2, T3, T4, 2; then the owner loads the folder through the seat, one batch an Apply it.
size: S + S + M + S + M + M + M + S + M
blocker: None.
mockup: themes-mockup.html — the catalog, the picker, the Timeline's theme row and bulk bar, the By theme investigation with the item window, the firm's view; the other pieces are a column, a policy and a chip on surfaces that exist
opinion: build — the HR file is the right record for the facts and the exhibits, the Legal desk the right page for the analysis, and themes are how a large record gets read again; the one honest limit is the counsel-only hold, which binds the seat as deployed and Drive, not a holder of the dev's own session
---

# The HR file carries a person's matter whole (#269)

## The ask, in the owner's words

2026-11-05, with a case folder about a former teammate on the desk: "let me know if you think our HR system is good enough it can handle taking it on?" Then: "there is one concept I would like to add, it is the idea of legal tags, the idea is that there may be a theme of 'tortious interference in business' or 'Dishonesty' or 'Disrespectful Conduct' and we would like to be able to tag evidence or recorded events with those tags to make the review of them later easier when it's a large situation." And on the review: "are we able to investigate all the evidence that makes up a theme and isolate the view for a user to a particular theme? and on that page click on some evidence to look at the greater detail in a modal without leaving that place in the page?" Then: "build it all, please test along the way with screenshots on multiple viewports asking yourself is this the best we can do."

## The decision

The folder stays the case file. The app takes the facts, the exhibits of any size, the analysis for counsel on a matter, and the themes that make a large record readable again. Counsel-only material gets a hold with a stated limit; the privileged recordings stay with counsel regardless.

- **A linked file, not a bigger cap.** The 10 MB cap is the edge function's body and the base64 round trip. A link keeps a large file where it already is, in the People drive, and the record says so. Rejected: a resumable upload straight to Drive, a day's work that still leaves the bucket without a copy.
- **Themes are company-wide words with a definition.** One line on what counts keeps a theme meaning the same thing across months and to the agent. Counsel's words stay a separate field: every legal label is a candidate, never a conclusion. Rejected: per-matter tag lists, which fragment across a person's HR file and matter.
- **A mark carries why and how.** Why it fits, in a few words, and how it proves the theme: a document, their own words, a firsthand account, a relayed account. That is the proof grade asked at the moment of marking, where it is cheapest. On the mark, not the item, because one fact can be strong for one theme and weak for another.
- **By theme is the investigation.** One theme isolated, its items in date order, each opening in a window over the list with Previous and Next; the pick in the address so a link reopens the same view. Rejected: a separate page, which loses the place in the record.
- **A matter on a person.** The Legal desk already has the narrative, the evidence with a hash and a state, the timeline and the firm. A matter kind that stands on a person instead of a payer, with the account tabs absent, gives the analysis a home without a second desk.
- **The counsel-only hold binds the seat as deployed and Drive.** The seat reads as the dev through a normal session, so RLS tells it apart by a header the seat always sends. A holder of the dev's own session reads the row. Said plainly in `docs/HR_FILES.md`.

Open: whether By theme should default to strongest first rather than oldest first; whether the item window should let a second theme be marked from inside it.

## Where it plugs in

- HR evidence: `person_file_evidence`, `person_file_attachments` (`storage_path` NOT NULL today), the kernel `supabase/functions/_shared/personEvidence.ts` (`EVIDENCE_FILE_MAX_BYTES`, `evidenceDraftProblem`, `evidenceDriveState`), the filer `supabase/functions/hr-evidence-drive`, the panel `src/components/people/personFile/PersonFilePanel.tsx`, the seat's `plan_person_evidence` → `apply_person_evidence` (`20261103060000_dev_person_evidence_write.sql`).
- The Timeline: `supabase/functions/_shared/personTimeline.ts` and the app's door `src/lib/people/personTimeline.ts`, the reads in `personTimelineIo.ts`, the seat's `get_person_file`.
- The Legal desk: `legal_matters` (`payer_key`, `customer_id`, `payer_name`, jobs through `legal_matter_jobs`), `legal_matter_save_review`, `legal_matter_entries` (kinds plan and event), `legal_matter_documents`, `src/components/jobs/legal/legalDeskShared.tsx` (`TABS`), `src/lib/legal/legalPacket.ts`, the seat's `plan_matter_*` verbs, the firm's portal `supabase/functions/legal-portal`.
- The agent role `hr_agent` and the seat's reads under the dev's RLS (`docs/ACCESS_CONTROL.md` → Database agent roles).
- New: `legal_themes`, `legal_theme_marks`, the seat's `plan_theme_marks` → `apply_theme_marks`, the By theme view and its item window.

## The plan

| PR | What | Size |
|---|---|---|
| 1a | A linked file on an evidence record: `storage_path` nullable with a CHECK that one of `storage_path` / `drive_url` stands; the filer skips linked rows; *in Drive, linked* in the kernel's words; a link row under the file picker; the seat's files as `{ name, drive_url }` | S |
| 1b | `sha256` on attachments, computed as the file is picked and by the seat; shown on the chip's tip; carried by `get_person_file` | S |
| 3a | `legal_matters.kind` (account \| person) and `person_id`; `legal_matter_open_person`; the desk's People group with Account and Paper absent and the money sections out of the packet | M |
| 3b | The HR file's Matter chip and Open a matter…; the seat's `plan_matter_open_person` → `apply_matter_open_person` | S |
| T1 | `legal_themes`, `legal_theme_marks`, RLS dev-only, the agent's propose and the dev's keep; the seat's doors; Settings → People → Themes | M |
| T2 | The picker in Add entry and Add evidence; + theme on a line; the Timeline's theme row with counts; tick lines and *Mark N lines*; ✕ with a reason and Keep on a proposed mark (shipped v2.6546) | M |
| T2b | The same picker in a matter's Record what happened and document form, and the matter Timeline's theme row | S |
| T3 | By theme beside Timeline, Evidence and Narrative, on the HR file and on a matter: one theme, the counts, oldest or strongest first, the item window with Previous / Next, the pick in the address, Print this theme, Copy as a list | M |
| T4 | The matter's packet gets a section per theme; the firm's portal reads themes grouped on Evidence and Timeline and may add its words | S |
| 2 | `counsel_only` on evidence: the filer skips it, `hr_agent` cannot read it, the seat sends `X-Dev-Seat` and restrictive policies refuse it, `get_person_file` names the hold, the panel's chip and filter, the doc's stated limit | M |

Then the load, through the seat on the owner's *Apply it* per batch.

## How to verify

Each PR: the kernel's tests, the panel's render smoke, the help-guide and release-note suites, typecheck and lint; then the dev server as the dev on a real person's file and a real matter at 375, 768 and 1280 px, with screenshots, read-only except the row the PR adds. The seat's doors: a plan reply quoted into an apply on a throwaway record, then a revert or a correcting record. Gotcha: the browser pane's viewport emulation does not fire `matchMedia` change events, so a phone layout is checked by mounting at phone width, not by resizing an open page.
