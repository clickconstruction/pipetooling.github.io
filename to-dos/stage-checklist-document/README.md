---
name: "Stage checklists as documents on the job: items anyone on the job can add, a stamp on every answer, a signature where the author asks for one, and a record that files itself"
number: 237
group: ready
status: thought through 2026-11-01 with the owner over a three-persona click-through; three mock-up files beside this card; nothing built; five calls carry the owner's recommendations as defaults until he says otherwise
summary: >
  The stage checklists of punch list #164 live in Settings, hold only the company's questions,
  and show the office nothing per job. The owner wants them moved onto the job's Documents tab as
  documents: anyone running the job adds a check for that job, every answer stamps the row with
  the person's name and the time, some items make the person sign the way the app signs a lien
  notice, the author of the list decides which, and the finished list files itself as a record
  with a number and a PDF in the job's Drive folder. The company's standard lists are made in the
  same place and promoted from a job, so Settings becomes a read-only mirror. The superintendent's
  line of #234 reads the same count as its proof.
next: PR 1, items on the job and the Documents read-out with the stamps shown. Useful on its own; nothing in it waits on a call.
size: L as a train of five (M · M · M · S · S); three migrations; no edge function beyond the PDF renderer the hours statement already has
blocker: none for PR 1 and PR 4. PR 2 takes "Not here signs" and PR 3 takes "files itself at the last answer" as the owner's defaults; he can change either before they build.
ver: v2.6072 · 6077 · 6084 · 6087 · 6219 · 6270 · 6069 · 6097 · 5077 · 3159 · 5245 · 3417 · 2927
opinion: now — the office has typed no questions yet because there was nowhere good to read the answers; this gives them the place, and the signature is what makes a checklist worth more than a report
mockup: to-dos/stage-checklist-document/mockup-document-and-signature.html
---

# Stage checklists as documents on the job (#237)

## The ask

The owner, 2026-11-01, reading the superintendent's line of punch list #234 whose red card offers
**Open the checklist**:

> I love that we have a button for open the checklist, but I recognize that we don't currently
> have the tools to have a superintendent add items to a checklist and an office add items and
> look at checklist and see checklist in the documents section of the edit job modal and a lot of
> the stuff surrounding this.

Then, asked where a checklist is made today and told the company's questions live on
Settings → Jobs & billing → Stage checklists and that prod holds none yet:

> I think that we need to bring the ability to make checklists and to see completed checklists
> out of settings and into the documents section where a checklist is memorialized in the form of
> a document. The idea being when someone signs off on a checklist item, they are stamping it with
> their name and that time and date.

And, asking whether that was the best we could do:

> Maybe we should add a signature next to some checklist items where just like the tooling that
> we have in the app for signatures we force a user to sign when they complete certain checklist
> items so they understand the severity and gravity. And this should be a toggle for the person
> making the checklist.

## The mock-ups

Three files beside this card, made-up names and figures:

- `mockup-document-and-signature.html` — the phone's signature moment (the item with the chip,
  the signature sheet with its gravity words and the "I did this check myself" line, the locked
  row after), the office's Documents section with a filed document, an open one and a stage with
  no list yet being authored, and the decisions and the plan.
- `mockup-items-and-readout.html` — the first pass: the technician's sheet with *Added for this
  job*, the superintendent's *Add a check*, the office's read-out at a desk and on a phone.
- `walk.html` — the click-through the thinking was done on: Technician on a phone, Superintendent
  on a phone, Office at a desk and on a phone, one shared job, a steps rail per persona that ticks
  off as you go and a log of what each press did for the others. It also holds #234's *Set the %*
  sheet with its live read-back, since the line and the checklist meet on the same card. The
  private artifact the owner clicked through is *Stage Checklist Walk* —
  https://claude.ai/artifact/V1TM7YbctmHp5Rj9TP4Ygu. **The walk's sheet is the design**: its
  second pass (below, *The sheet*) came after the owner read the first and said it was not the
  best we could do; the phone boards in the two mock-up files still draw the first pass.

## The thinking

**What exists (#164).** The office writes a short list of questions once per stage kind, Rough
In, Top Out and Trim Set (`stage_checklist_templates`, Settings → Jobs & billing → Stage
checklists, v2.6077); the kind is read from the stage's name the way the Pipeline recognizes the
three (v2.3417), so every job with such a stage shows the checklist the day the office types the
questions. The crew answers each on the phone with Yes, No or Not here, a note and a photo where
asked, every press saving by itself (`stage_checklist_answers`, the sheet and the strip,
v2.6084); a stage reads *not ready* on the Pipeline until every question is answered (the strict
rule, v2.6072; the ☐ mark, v2.6087); a report photo can answer a question (v2.6219); the photo's
road is the customer's Drive folder (v2.6090). The lists shipped empty by the owner's call: he
writes the words himself. What is missing is anything per job, any reader for the office, and
any weight behind an answer.

**A checklist is a record on the job, not a setting.** Each stage's list becomes a document on
the Documents tab, in the signed hours statement's shape (v2.6069, v2.6097): `stage_checklist_records`,
one per job stage, with a snapshot of the questions as they stood (the words never change under
an answer), a record id `CL-<job number>-<n>` counted per job, a state (open · filed · amended),
`filed_at`, and the PDF's Drive id. It files itself when the last row is answered, stamped by
that answer's time; a PDF lands in the job's Drive folder by the sweep that already files
checklist photos. Filed means immutable: adding a check or taking an answer back starts version
n+1, and version n stays readable and printable.

**Items on the job.** Beside the company's null-scoped question rows, rows scoped to a job and a
stage (`job_id` + `fixture_id`), so the answers table, the kernel's strict rule and the sheet
change nothing but their grouping: the sheet shows *The company's questions* and *Added for this
job*, each item saying who added it and when. Who adds: the office set and the superintendent on
his jobs. The technician answers and notes; he does not add. Who takes off: the adder or the
office; retired keeps its answer. A job item counts toward *ready* like a company question, so an
item added after a stage read ready flips it back, which is the point.

**The stamp exists.** `stage_checklist_answers` keeps who and when on every press. The sheet, the
read-out and the paper now show it on every row: *Luis Ortega · Nov 1 · 9:14 am*.

**The signature is the app's own.** `src/lib/jobs/lienNoticeSignature.ts` (v2.5077) says what
makes a signature: the record, not the mark; a symbol adopted with intent by one press, the
signer's own act under his sign-in, bound to the fields as drafted by a hash so a later change
voids it. The Bid Room's `bidRoomSignature.ts` (v2.3159) carries the printed name, the agreed
line and the typed-or-drawn mode (`SignatureTypeOrDrawInput`). A checklist item the author
marked *needs a signature* does the same: pressing an answer opens the signature sheet, which
says what is being claimed and who will read it ("You are signing **Yes** to *Did the final water
test hold?*. It goes on J1042's Trim Set record with your name and the time. The office, the GC
and an inspector can read it."), takes the mark, asks for "I did this check myself and the answer
is true", and stamps the row. Columns on the answer row: the mode, the PNG path, the printed
name, the hash of the answer as given, the time. A signature item is not answered until it is
signed; Not here signs too, since it is the claim an inspector would test. A signed row locks.
*Take it back* writes a new answer row with a reason; the voided signature stays. The mark is a
small PNG and rides the outbox the way report photos do, so a signature on one bar of signal
still lands.

**The author decides.** *Needs a signature* is a toggle beside *Asks for a photo* on every add
box: the superintendent's on the phone, the office's on Documents, and the company's list when
it is authored. The guide's words for it: use it where a wrong answer costs a wall or an
inspection.

**One door.** The office authors and reads in the same place. A stage with a list shows it as a
document: filed with its record number, time and Drive copy, or open with what is left, every
row with its pick, stamp, note, photo and mark. A stage with no list offers to make one, item by
item with the two toggles, for this job or as the company's list for that kind; a job's list can
be promoted with *Use as the company's list*. Settings → Stage checklists becomes a read-only
card that says which job each list came from, for one release, then goes.

**The sheet.** The phone sheet is two things, never one form. While the list is open it keeps
one row open at a time: a progress bar under the title with *2 of 5 answered · 3 left*; the next
unanswered question as the one big row, labelled *Next*, with the three presses at 44 px, its
*needs a signature* and *photo* chips, and *Add a note* as a link that opens the box; every
other row a statement, ✓ ✗ or — · the words · the name and the time · the ink where it was
signed · a thumbnail where there is a photo, which a tap reopens to change. After an answer the
list moves to the next question by itself; a signed row that still owes its photo stays open
with the mark, *Take it back* and *Take the photo*. Once filed the sheet reads as paper: the
header *Rough In · filed · Record CL-1042-1 · Oct 15 · 4:02 pm · in the job's Drive folder · 4
answers, 1 signed*, every row a statement, nothing to press but a signed row that opens to show
its mark, and the foot *Filed. Nothing here changes; the office can amend it as a new version.*
with Close. What this replaced: a sheet that kept three buttons and an empty note box on every
answered row, said the count twice, buried the record number at the foot, and never said which
question was next.

**The paper.** *Print the checklists* draws the three stages on the light paper a pay
application prints on: every answer with its name and time, a signature where one was required,
the record number once filed. It is what an inspector or the GC reads, and the filed PDF is the
same paper.

**Is that the best we can do?** Three more, in order of worth, none in this train: a third
toggle, *asks for a number* with a unit, so "Did the test hold?" becomes "Test pressure · 60 psi
· 15 min"; a countersign toggle for the superintendent's mark under the crew's; and the filed
PDF riding the GC portal and the pay application packet.

## Open questions

The owner's, each with the recommendation the build takes unless he says otherwise:

1. **Files itself at the last answer, or by a press?** Itself: a press is a step no one will take,
   and the last answer's stamp is the filing time.
2. **Not here on a signature item: sign or not?** Sign. It is the claim an inspector would test.
3. **Who may mark an item as needing a signature?** Whoever may add it: the office, and the
   superintendent on his jobs.
4. **Retire the Settings card, or keep it as a read-only mirror?** A mirror for one release, then
   gone.
5. **The number-with-unit item kind now or later?** Later, after PR 2 has shown what a signed
   answer reads like on the paper.

And two the build will meet: whether a technician may *Take it back* on his own signed answer or
only the superintendent and the office (the walk lets him); and whether a filed record's PDF is
remade on every version or each version keeps its own file (recommended: each version its own).

## Where it plugs in

What exists:

- `stage_checklist_templates` and `stage_checklist_answers` (v2.6077), the kernel
  `src/lib/jobs/stageChecklist.ts` with `questionWaitsOn` and `stageChecklistState` (v2.6072),
  the sheet `StageChecklistSheet.tsx` and the strip `JobStageChecklistStrip.tsx` with
  `stageChecklistSheetIo.ts` (v2.6084), the Pipeline's mark `stageChecklistMarks.ts` (v2.6087),
  the editor `StageChecklistSettingsCard.tsx` over `stageChecklistEditor.ts` (v2.6077), a report
  photo answering a question `reportPhotoChecklist.ts` (v2.6219), the `photo-save` sweep's
  checklist source (v2.6084).
- Who may answer: `can_report_stage_progress(job_id)` (v2.5245's family), the office and the
  superintendent and crew on their own jobs; the job's stages are its Stage Plan rows
  (`jobs_ledger_fixtures`, windows v2.2927).
- The Documents tab `JobWindowDocumentsTab.tsx` with its paper sections, and the hours
  statement's record shape: `hours_statements` with `snapshot`, `HS-<job>-<n>` and `state`, the
  kernels `functions/_shared/hoursStatement.ts` and `hoursStatementRecord.ts`, the window and
  section (v2.6069, v2.6097).
- The signature: `lienNoticeSignature.ts` and `signedRecordId.ts` (v2.5077),
  `bidRoomSignature.ts` and `SignatureTypeOrDrawInput.tsx` (v2.3159), `SignedSignatureBlock.tsx`.
- Every uploaded photo on one list, `uploaded_photos` (v2.6270), which the checklist PDF joins as
  a document, not a photo.

What is new: the job-scoped question rows and their policies; the signature columns on the
answer and the signature sheet; `stage_checklist_records` with the freeze, the id, the versions
and the PDF; the Documents section, desk and phone, with the inline add, take off, amend,
promote and print; the Settings card read-only; the guides.

## The plan

1. **PR 1 · items on the job and the read-out** (M). The job-scoped rows (one migration with the
   adder, the time and `retired_at`; RLS by `can_report_stage_progress` for the superintendent and
   the office set for writes), the kernel's grouping, the sheet rebuilt as *The sheet* above
   describes (the progress header, one *Next* row with the presses, statement rows with the stamp,
   *Add a note* as a link) with the second group and the superintendent's *Add a check*, the
   Documents section on desk and phone with inline add and take off, the guide *add a check to a
   job's stage checklist*. Useful on its own.
2. **PR 2 · needs a signature** (M). The toggle on every add box, the signature columns on the
   answer (one migration), the signature sheet with the gravity words and the agreed line over
   `SignatureTypeOrDrawInput`, the lock, *Take it back*, the outbox ride, the guide *sign a
   checklist answer*.
3. **PR 3 · the record** (M). `stage_checklist_records` (one migration), files itself at the last
   answer, the id, the PDF to the job's Drive folder by the sweep, *Amend* as a new version,
   *Print the checklists* on the pay application's paper, the Documents section reading filed and
   open.
4. **PR 4 · authoring on Documents** (S). Make a list for a stage with none, *Use as the company's
   list*, the Settings card read-only with the source line; the guide *write the questions for a
   stage checklist* rewritten to the new door.
5. **PR 5 · the line's proof** (S). The superintendent's line of #234 reads this count; lands
   with #234's PR 3 or after it.

## How to verify

On the dev server as the dev, prod data, nothing written outside ZZ Test rows: on a ZZ Test job
with Rough In, Top Out and Trim Set, type two questions for Trim Set on a ZZ Test job's Documents
tab, one with *needs a signature*; as the Superintendent sample through View as, add a check on
the phone preset; as the crew, answer the plain one and read the stamp, press Yes on the signed
one and read the sheet's words, sign, read the locked row; answer the last and read *Filed as
record CL-<n>*; back at the desk read the filed document, print it, amend it and read v2 open
with v1 still filed; press *Use as the company's list* and read the Settings card's source line.
Delete every ZZ Test row after.

## Where it stands

2026-11-01: thought through with the owner on the click-through and mocked up; nothing built.
The owner asked to build it. PR 1 and PR 4 wait on nothing; PR 2 and PR 3 take the recommended
answers to calls 1 and 2 as defaults. Later the same day the owner read the sheet and asked for
better; the walk's sheet is now its second pass (*The sheet* above) and PR 1 builds that one.
