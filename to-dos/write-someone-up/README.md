---
name: "Write someone up, from the Dashboard, on a phone"
number: 410
group: close
status: asked by Taunya 2026-11-20 · assessed, drawn twice and put to her the same night · her go 2026-11-21, *build it all and let me know when it's live*, with every pick kept · building on worktree-write-someone-up
summary: >
  Taunya said writing someone up was not made easy enough for a leader or a superintendent from
  their Dashboard. A leader's only door was the HR Report card, 8.7 phone screens down the full
  Dashboard and folded, and a superintendent had none. The plan is one named press, Write someone
  up, on the full Dashboard, the short Dashboard and Job Mode. It opens a phone sheet: who, what
  kind, what was seen, photos, who saw it, then a read-back and one press that sends. It lands in
  the Pending reports the office already reads, with the job, the time and the facts the record
  lacked. Seven PRs, built on the HR report queue and not on the Writeups forms.
next: Build the train in order, the migration first and alone. Walk it on a ZZ Test person after each deploy.
size: L as a train of seven (S · M · S · M · M · S · S)
blocker: None. The person's side and a kept voice recording are set aside, see *Set aside*.
opinion: build — the first screen PR gives a leader and a superintendent a door they did not have, and nothing lands on a file until the office files it
---

# Write someone up, from the Dashboard, on a phone (#410)

The mock-up is [`mockup.html`](mockup.html): ten frames, 380 px wide, in light and in dark. Every name,
job, address and event on it is made up. The repo is public, so nothing below is a real name or event.

## The ask

Taunya, 2026-11-20:

> I don't think we did a good enough job making it easy for a leader or superintendant to write someone up
> from their dashboard. I think that we should add a feature that allows a leader to click one thing, choose
> a person, and then write up what that person did wrong and with details on their phone that we can record
> and save to HR.

She asked for a plan, a mock-up and a pass of *is this the best we can do?*. On 2026-11-21, after reading
them: *I like what you are proposing, please build it all and let me know when it's live.*

## What the assessment found

Read in the code on `main` and walked at 375 px wide as the leader's and the superintendent's sample
accounts. Nothing was written.

- **Two things are called a write-up.** People, Paperwork, **Writeups** is a form built from an office
  template (`writeups`, `writeup_templates`). The **HR Report** card on the Dashboard writes a short dated
  note about a person (`person_reports`), which waits on People, HR, **Pending reports** until a dev files
  it onto the person's Timeline.
- **A leader's door was far away.** The HR Report card sat 7,095 px down a page 8,209 px tall, 8.7 screens,
  folded. It was not on the short Dashboard or in Job Mode. Its presses were 27 to 36 px tall. One press
  sent, with no confirm.
- **The Writeups window does not fit a phone.** It is 420 px wide on a 375 px screen, and People is not on
  the phone's bar.
- **A superintendent had no door.** The card was not drawn for the role, the database refused the save, and
  People sent the role back to the Dashboard.
- **The record lacked** the job, the time, the kind, who saw it, whether the person was told, and a photo.
  With no signal the send failed and nothing was kept.

## The decision

Built on the HR report queue. Its subject is a roster row, so a person with no login can be written about.
An author reads only their own. Nothing reaches a file until the office files it. The Writeups forms stay
the office's formal paper, and the office can start one from a field write-up.

The flow, as the mock-up draws it:

1. **Write someone up**, a named line under the top row. The row of squares is full at phone width.
2. **Who is it about?** The crew on the job today first, then this week's, then a search. Nobody is on
   their own list.
3. **What happened.** Who, when and which job are filled in. The kind, then what was seen, typed or spoken.
   Photos, who saw it, and whether the person has been talked to.
4. **Read it back**, then **Send write-up to HR**, the only press that saves.
5. The writer's own write-ups, each with where it stands. With no signal it is kept on the phone.
6. The office's Pending reports card with every fact, filed to the Timeline as before.

## Taunya's calls

All were put to her with a pick on 2026-11-20. Her go kept every pick.

| Call | Kept |
|---|---|
| What it is built on | The HR report queue |
| The name | **Write someone up** |
| Good news through the same press | Yes, as the last kind |
| *Details we can record* | Photos, and spoken words the phone types. No sound is kept. |
| Where it lands | The office reads it first, as before |
| Who reads the queue | Dev seats, as before, with a line the same day. She names anyone else later. |
| Whom a leader may write up | Anyone but themselves |
| The short pages | They show the press |
| The person written up | Told nothing by the app |
| Take it back | Until the office files it, kept with its reason |

## The plan

1. **The database half (S).** The record's new facts, the superintendent's right to write and to read their
   own, the list of people and the function a send lands through. A migration, pushed alone.
2. **The press and the sheet (M).** The kernel, the sheet, the press on the full Dashboard for a leader and
   a superintendent, spoken words, the read-back and the writer's own list. The help guide.
3. **The short pages (S).** The same press on the short Dashboard, Job Mode and its Short view.
4. **No signal (M).** The write-up is kept on the phone and sent when the signal is back.
5. **Photos (M).** Taken in the sheet, kept with no signal, a numbered evidence record once filed. A migration.
6. **The office's card (S).** Pending reports shows the facts, a line the same day, and Start a Writeup.
7. **Add to it and Take it back (S).** A small migration.

## Set aside

- **The person's side.** The office presses *Show it to them* on one write-up, and the person reads it and
  writes their side. It is Taunya's and the owner's call. Frame 10 of the mock-up draws it.
- **A kept voice recording.** It needs storage, a rule for who may play it, and a lawyer's answer before the
  app keeps sound of another person.

## Where it plugs in

- Exists: `person_reports`, `file_person_report`, `dismiss_person_report`, `DashboardPersonReportCard`,
  `HrPendingReportsSection`, the outbox (`src/lib/offline/outbox.ts`), report photos (`useReportPhotos`),
  spoken words (`useVoiceNote`), the supervision rule (`src/lib/people/supervision.ts`).
- New: the kernel `src/lib/people/writeUp.ts`, the sheet under `src/components/writeUp/`, and the press.

## How to verify

Kernel tests on made-up rows. A live walk on a `ZZ Test` person as a leader and as a superintendent, 375 px
wide, with every row made deleted or named in the report. Never a write-up on a real person.
