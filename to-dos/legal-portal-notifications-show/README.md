---
name: "Firm portal: the Notifications tab shows each person what they will get"
number: 233
group: ready
status: card and mock-up 2026-11-01 from the owner's ask the same day · the thinking, a first pass, the render, a second pass · nothing built · the owner's three calls at the foot, a recommendation on each · call 3 added the same day on the owner's question, does the digest cover everything that changed · the digest's shape by matter decided the same day on the owner's word · calls 1 and 2 answered 2026-11-01, A and A, in the owner's words *A typed Title* and *Sample inbox, one email open* · PR 1 the form v2.6278 (claude/233-notifications-form-row) · PR 2 the sample inbox v2.6280 (claude/233-notifications-sample-inbox) · PR 3 the digest by matter v2.6281 (claude/233-digest-by-matter), all three built 2026-11-01
mockup: to-dos/legal-portal-notifications-show/mockup.html
summary: >
  The law firm's portal has a Notifications tab where the firm adds its people and sets how each hears
  from the office. Today the add form's Role dropdown (paralegal, attorney, billing) reads as if each role
  opened a different door, and the column is a free-text label that gates nothing; beside it, two
  paragraphs explain the tab in 171 words, one sentence 38 words long. The redraw makes the add form the
  row it becomes, with the two rules in it, turns Role into a typed Title that says where it shows, and
  replaces the paragraphs with the thing itself: a sample week of the person's inbox that follows the
  rule as it is switched, each subject line opening its email, and a count under Only theirs that reads
  from the firm's own matters. Fifty words of prose where there were 171. Two PRs, no migration, one
  function redeploy.
next: PRs 1 to 3 merge, then `supabase functions deploy submit-legal-portal` and `legal-notify-dispatch`; call 3 decides PR 4 (the digest carries every office act).
size: S as a train of three (S · S · S), M with call 3's PR 4
blocker: Call 3 for PR 4; the two function deploys after the merges.
opinion: build as drawn — the title typed, the switches in the form, the inbox with one email open; the role presets and per-event picks stay unbuilt until a firm asks; call 3 is worth its one migration, since the digest today is not the record it reads as
---

# Firm portal: the Notifications tab shows each person what they will get (#233)

## The ask

The owner, 2026-11-01, looking at the firm portal's Notifications tab with the Role dropdown open (paralegal ·
attorney · billing) and the two prose blocks *How this behaves* and *What you hear about* beside the add form:

> I do not like the role drop down. I do not think it makes it clear what that particular role will have access
> to. And I do not like the How this behaves and What you hear about, I find it very wordy. We should do a better
> job of showing instead of telling. Help me think of how to improve this, then ask yourself, is this the best we
> can do? Then show me a mock-up. Then ask yourself again, is this the best we can do? And present to me the final
> mock-up.

## The read

What the tab is, read in the code on 2026-11-01:

- **The role gates nothing.** `legal_firm_recipients.role` is text, default empty, capped at sixty characters in
  `submit-legal-portal`'s `recipient_add`. Three places read it, all as a label: the person's row on this tab, the
  office's list on the Legal desk (`LegalDesk.tsx`, *name · email · role*), and the *Recorded by* picker on a
  matter (`RecordedByPicker`, *name · role*) and the intake form's picker. So the dropdown promises an access
  difference the system does not make. Everyone holding the link reads every matter; email is the only thing that
  is per person.
- **Every person gets the same seven events**, filtered by two rules of their own: `mode` (`now` | `digest`) and
  `scope` (`all` | `mine`), plus a digest weekday and Central time. The events are `LEGAL_NOW_TRIGGERS` in
  `_shared/legalEmails.ts`: referred, answer, ask, note, applied, pulled, and `fee_seen`, which
  `legalTriggerSendsNow` holds to the digest only. A person on *Each event* never hears a fee the office saw.
- **Only my matters matches by name.** `legal-notify-dispatch`'s `canSee` compares the recipient's typed name,
  lowercased and trimmed, with the matter's `handling_name`, the name the office wrote on the matter at release. A
  paralegal who picks *Only my matters* and is named on no matter hears nothing, and nothing on the tab says so.
- **`recipient_add` already takes `mode` and `scope`** (defaulting to `now` and `all`); the page never sends them,
  so every new person starts on *Each event · Every matter* and is changed afterwards on their row. It does not
  take the digest weekday or time.
- **The words a first-timer reads today**, counted on the mock-up's first section: the empty state 32 words, *How
  this behaves* 67, *What you hear about* 59, the form 13: **171**, with a 38-word sentence and a 22-word one, a
  colon and a semicolon as glue. The plain-words rule (`src/lib/plainWords.ts`) is 20 words and no glue.
- **The digest does not cover everything that changed** (the owner's question, 2026-11-01). The digest reads
  `legal_notification_queue` since the last digest, and only the seven acts above write a row (the triggers in
  `20261006170000_legal_firm_notify_events.sql`): the entries trigger ignores a step the office records, a planned
  step, a what-happened event, an offer, a statement, a step moved back, an undo and a signed-off step; nothing
  watches `legal_matter_documents` (a paper added, held papers released) or the narrative; a matter closed sends
  nothing. A stage change shows only sideways, as the stage word on the *Open matters* list. And the stamp is
  firm-wide by weekday: a row is marked digested once the people due that weekday are sent, anyone on another
  weekday counting as served (the dispatcher's own comment calls it an approximation), so with Owen on Monday and
  Priya on Wednesday, Priya's digest holds Monday to Wednesday only. Two more limits: 200 rows per digest, and a
  person who confirms later never gets what came before (by design, v2.3325).
- The red band for an office pause already draws when it happens (`payload.firmPaused`), and a removed person
  simply leaves the list; the sentence that says so is the only trace of either.

## The thinking

### The role

1. **A typed Title that gates nothing** — recommended, drawn. The field reads *Title*, optional, placeholder
   *attorney, paralegal, billing*, with one hint: *Optional. Shows beside their name, here and to the office.* It
   is the same column, the same three readers, and the word now says what it is. The rules are the two switches in
   the form.
2. **A pick that sets the starting rules and says so**: *attorney · each event, every matter*, *billing · weekly
   digest, every matter*, *paralegal · each event, only theirs*. Considered and not recommended: it adds a third
   thing to learn, it guesses wrong for half the firms (a billing clerk who wants each applied payment the moment
   it lands), and the paralegal preset lands on *Only theirs*, which hears nothing until the office names them. The
   two switches are two taps, and they are in the form now, so a preset saves nothing.
3. **Per-person event picks**: each person ticks which of the seven they hear. Considered and not recommended now:
   seven boxes per person is the wordy thing again, no firm has asked, and the digest already separates the money
   lines (applied, fee seen) from the rest. It stays open as the owner's call 1, option C.
4. **Drop the role.** Considered and cut: the office reads it on the desk, and *Recorded by* uses it to tell two
   names apart.

### The two paragraphs

Each sentence, and what shows it instead:

- *Each person chooses an email for each event or a weekly digest, and every matter or only the ones they
  handle* → the two switches sit in the add form, and the sample inbox swaps as they are pressed.
- *A new address gets one confirmation email and nothing else until they click it* → the button says *Send Lena a
  confirmation*, the new row reads *not confirmed yet* with *Resend the confirmation* beside it, and one nine-word
  line stays under the button: *Nothing else goes to them until they click it.*
- *Every email carries a one-click link to stop* → the opened sample email ends in the real footer with *Stop
  these emails to you*.
- *The office can pause all emails to the firm or remove a person; you see that here when it happens* → the red
  band already draws when it happens. The sentence goes.
- *What you hear about*: the seven events → seven subject lines in a sample inbox, as the builders write them, with
  the day. *A fee or cost the office saw rides the digest only* → that line sits dim at the foot of the *Each
  event* inbox with the tag *weekly digest only*; in the digest it is a line like the others. *The digest also
  lists every open matter* → the digest sample opens on its *Open matters* list.
- The fact the words never said, the name match → a count under *Only theirs*, read from the firm's own open
  matters: *The office names Priya Natarajan as handling 1 of 3 open matters today.* A zero is the warning.

Forms considered for the showing: a timeline of the seven events with a mark on the digest-only one (cut: a list
that tells); one sample email alone (kept, and joined by the inbox list, because one email shows the frame and the
stop link but not the week, and the digest's point is that it is one email where the other rule is six); the list
row drawn as it will look once confirmed (taken as the form itself: the card the firm fills has the same fields and
switches as the card it becomes).

### The digest reads by matter

The owner, 2026-11-01, on the first digest sample: *"It puts the date and then what happened and then the context
which is what account it matters for last. I would instead like this to be sorted by the Ridgeway Builders and
then everything for Ridgeway Builders underneath it and then Northline Builders and then everything for Northline
Builders underneath it."* Decided, not a call. `buildLegalDigestEmail` drops its two lists (*Open matters*, *Since
your last digest*) for one: every matter the person can see as a heading with its stage line (*Ridgeway Builders —
referred · handling Dana Whitlock · since 2026-10-26*), the week's lines under it as *day · what happened — detail*
(*Oct 27 · The office asks — Do you have the signed change order for the add?*), matters with news first, then the
quiet ones each reading *Nothing new this week*; a matter withdrawn during the week keeps its heading, reading
*referral withdrawn · was handling …*, since it is no longer on the open list the dispatcher reads. The day prints
short (*Oct 26*). The builder is pure and shared, so the sample inbox and the real email change together.

### The sample week is made up, and says so

The subject lines name sample accounts, never the firm's real matters: a sample *Referral withdrawn: Cedar Bend
Homes* on a real matter would read as news. The caption reads *a sample week*. The handling count is the one real
figure, and it is a count.

### The words

Fifty words of prose where there were 171, every sentence under twenty words, no glue: the caption *Add a person at
the firm*, the labels *Name*, *Email*, *Title*, *Emails*, *Matters*, the Title hint, the four switch words, the
button, the one line under it, and the inbox caption; plus the twelve-word count when *Only theirs* is picked, and
the empty state's nine words with its press *Add the first person*. The subject lines and the opened email are the
thing itself, quoted from the builders, so they are not counted and not rewritten. *Only my matters* becomes *Only
theirs* on the row too, so the form and the row read one way.

## The mock-up and its second pass

`mockup.html` (also published as an artifact, *Firm portal: Notifications shows* — https://claude.ai/artifact/3DYoCaN2jYK9bPwHs5sndP) draws today's right column counted, the proposed tab live at desk width (type a name, press the
switches, press a subject line) and at 390 px, the first pass's reasoning, and the owner's two calls. The first
render was looked at and redrawn once; the blue *Second pass* box under each frame says what the screenshot showed
and what changed:

- The form's *Matters* switch sat on its own line pushed to the right edge, as on a row, so the two rules read as two
  kinds of thing → in the add card both switches sit at the left under aligned labels; a row keeps *Matters* at the
  right where today's page has it.
- The inbox cut every subject with an ellipsis and the account's name was the part lost (*Click Plumbing and
  Electrical asks you a…*; five words at phone width) → a subject wraps onto a second line.
- Added after the render: each subject line opens its email under the list, so the firm reads any of the seven, not
  only the first; the dim fee line opens nothing, because under *Each event* it is never sent.
- Kept: the phone's order (the people, then the add card), as today's page stacks it; the opened referral naming
  Dana as handling Ridgeway while Lena is on *Every matter*, which is what that email will say.

## The owner's calls

Answered 2026-11-01, relayed from the main session in the owner's words: call 1 *A typed Title* (A), call 2 *Sample inbox, one email open* (A). Call 3 is open.

1. **What is the role?** A: a typed Title, optional, that gates nothing (recommended, as drawn). B: a pick that sets
   the starting rules and says so, the switches still shown and changeable (one PR more). C: per-person event picks
   (a migration for the picks, the dispatcher, both desks: two PRs more).
2. **How deep is the preview?** A: the sample inbox and one email opened under it, any line pressable (recommended,
   as drawn). B: the inbox alone with a *Read one ›* fold; shorter on a phone, and the stop link is a sentence again.
3. **Does the digest carry every office act?** Added on the owner's question. A: yes, as PR 3 (recommended): a
   digest-only line per office act the way the fee line already rides, so *Since your last digest* reads *Step by
   the office: Cedar Bend Homes — demand sent*, *Planned step*, *What happened*, *Offer*, *Statement*, *Paper added:
   the signed subcontract*, *Papers released*, *Matter closed*; and a per-person stamp so two weekdays no longer
   split the week. Each event stays as it is: six emails a week is the rule's point, and a paralegal entering six
   costs should not get six emails back (the v2.4600-era rule in `legalEmails.ts`). B: leave the digest as the
   seven acts, and the sample inbox stays honest to it. The tab does not change either way.

## Where it plugs in

- **The page**: `src/pages/LegalPortal.tsx`, `NotificationsPanel` (today around lines 645–716): the person cards,
  the add form, the two prose blocks. `.legalPortalPair` and `.legalRecipientScope` in `src/index.css` hold the two
  columns and the phone stack.
- **The acts**: `supabase/functions/submit-legal-portal/index.ts`: `recipient_add` (name, email, role, and already
  `mode` and `scope`), `recipient_rules` (mode, scope, digestWeekday, digestTime), resend, stop, resume. New: the
  weekday and time on `recipient_add`, deploy-order safe (an old function ignores them and keeps Mon 07:00).
- **The row**: `legal_firm_recipients` (`20260911204604_legal_firm_recipients.sql`); no column changes for calls
  1A or 1B. Call 1C adds a column of picks.
- **The words**: `FIRM_EMAIL_MODE_WORDS` in `_shared/legalEmails.ts` (re-exported by `src/lib/legalEmails.ts`),
  `firmRecipientStatusWords` and `firmSavedWords` in `src/lib/legal/legalFirmWords.ts`. New words (the labels, the
  hint, the line under the button, the count line, the inbox caption) live in `legalFirmWords.ts` with a
  plain-words test.
- **The sample inbox**: a new pure kernel, `src/lib/legal/legalFirmSampleWeek.ts`: the seven sample events on
  made-up accounts, filtered by a rule (mode, scope, the typed name against the sample matters' handling names),
  returning the lines and the opened email through the real builders `buildLegalNowEmail` and
  `buildLegalDigestEmail`, which the client already imports. The email HTML draws in a sandboxed `<iframe
  srcdoc>` as Settings → What customers see draws the same builders. The handling count reads
  `payload.matters[].handling` against the typed name with `canSee`'s rule.
- **The payload**: `src/lib/legal/legalPortalPayload.ts` (`LegalPortalRecipient`) already carries role, mode, scope,
  weekday, time, confirmed, paused, failingSince; nothing new to parse.
- **The sample portal** (`sampleLegalPortalResponse`, `customerSampleFixtures.ts`) and the office's preview
  (`data-legal-office-preview`) render the same panel, so both show the inbox; the sample saves nothing, as today.
- **The smokes**: `src/pages/LegalPortal.notifications.render.test.tsx` opens the tab on *Add a person at the
  firm*; the caption stays.
- **The guides**: `manage-who-at-the-law-firm-gets-emails.md` (the office's guide: *What the firm sets* gains Title,
  Matters, the count line and the sample inbox; *Only my matters* reads *Only theirs*) and
  `share-your-attorney-their-portal.md` where it names the Notifications page. The welcome email's step 3 (*Each
  person sets Emails to Each event or Weekly digest, and picks every account or only their own*) stays true.
- **The office's side**: the Legal desk's list reads the Title where it read the role, the same column.
  `PROJECT_DOCUMENTATION.md` / `GLOSSARY.md` where they name the Role field.

## The plan

1. **PR 1 — the form is the row** (S, client plus one function redeploy). The add card with Title in place of Role,
   the two switches and the digest day and time in it, sent on `recipient_add`; `Matters` labelled on the rows and
   the form; *Only theirs* on both with the count line from the payload's matters; the two prose blocks and the
   empty state's second sentence removed, the press *Add the first person* added; the words in `legalFirmWords.ts`
   with their plain-words test; the smoke extended (the add sends mode and scope; the count line reads 1 of 3 for
   the sample's handling person). `submit-legal-portal` takes `digestWeekday` and `digestTime` on the add. Guides,
   release note, fragment.
2. **PR 2 — the sample inbox** (S, client only). `legalFirmSampleWeek.ts` with its tests (the seven lines under
   *Each event*, one under *Weekly digest*, the fee line dim and never opened, *Only theirs* narrowing to the typed
   name's matters and the no-matters line, the opened email through the real builders); the inbox under the add
   card's button, a line pressable; the render smoke (the inbox swaps on the switch). Guide, release note, fragment.
3. **PR 3 — the digest reads by matter** (S, decided). `buildLegalDigestEmail` regrouped as above, with its tests
   (a matter with news, a quiet one, a withdrawn one, *Only theirs* narrowing the headings); the dispatcher passes
   the events it already has, so no query changes. Deploy: `supabase functions deploy legal-notify-dispatch`;
   Settings → What customers see draws the new shape. Release note, fragment, the guide's digest sentence.
4. **PR 4 — the digest carries every office act** (M, on call 3A): one migration that widens the entries trigger
   to every office-made kind (step, plan, event, offer, statement, and a `closed` row from the matter trigger) and
   adds a trigger on `legal_matter_documents` for a paper added and for held papers released, each queued under a
   new trigger word that `legalTriggerSendsNow` holds to the digest; `LEGAL_NOW_TRIGGERS` and `DIGEST_LABEL` gain
   the words, in the firm's vocabulary from `firmEntryKindWords`; the dispatcher stamps `sent_to`-style per person
   for the digest lane (a `digested_to` ledger beside `sent_to`, same shape as `legalNotifyLedger.ts`) so each
   weekday's person reads back to their own last digest; the sample inbox's digest shows the new lines. Deploy:
   client, then `supabase db push`, then `supabase functions deploy legal-notify-dispatch`. Its own
   `docs/migrations/` page and `EDGE_FUNCTIONS.md` section.
5. If call 1 is B: **PR 5** adds `legalFirmRolePreset.ts` (the three presets as rule patches) and the pick above the
   switches, which set them. If call 1 is C: a migration for the picks column, the dispatcher's filter, both desks'
   rows, and the sample inbox honouring the picks; two PRs.

- Call 3A on the dev bed: as the dev, record a step and add a paper on a ZZ test matter; the queue holds a row for
  each with the new trigger words; no *Each event* email goes; the next digest lists both lines; with two digest
  people on different weekdays, each digest reads back to that person's own last send.

## How to verify

- Dev server as the dev; Settings → What customers see → the legal portal sample, or `/legal?t=<sample token>`:
  the Notifications tab with Ann Sample and Bo Sample; the add card with the switches; type *Ann Sample* and press
  *Only theirs*: the count reads 1 of 1 open matter; the inbox narrows; press *Weekly digest*: one line and the
  digest opened under it with *Open matters*.
- On the live firm's portal (the office's preview from the Legal desk header, *Preview what the firm sees*): the
  real people and rules unchanged; the inbox on sample accounts; the count on the firm's real matters.
- Phone width 390 px: the people, then the add card, the inbox under its button, nothing clipped.
- Gates: typecheck, lint, `npm test` on the legal suites, the guide tests (`helpGuidePlainWords`, content, links,
  share cards), `check:todos`, the release-notes test, `check:empty-words`, `check:batch-words`.

## Where it stands

Card and mock-up, 2026-11-01. Calls 1 and 2 answered the same day, both as recommended; PR 1 (v2.6278), PR 2 (v2.6280) and PR 3 (v2.6281, the digest by matter) built the same day, stacked. Call 3 was added the same day on the owner's question whether the digest covers everything that changed, and the read says it does not; it is open.
