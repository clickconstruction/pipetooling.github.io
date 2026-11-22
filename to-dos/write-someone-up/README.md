---
name: "Write someone up, from the Dashboard, on a phone"
number: 410
group: close
status: asked by Taunya 2026-11-20 · assessed, drawn twice and put to her the same night · her go 2026-11-21, *build it all and let me know when it's live*, with every pick kept · the database half v2.8157, pushed 2026-11-21 · the press, the sheet, the short pages, no signal, the office's card, Add to it and Take it back v2.8160, walked on a ZZ Test person the same day · photos v2.8172 and v2.8174, with the old HR Report card retired, walked live on a ZZ Test person 2026-11-21: taken, sent, shown to the office and filed with its evidence record · walked again at an iPhone's size as a leader, as a superintendent and with the signal cut · the person's side dropped on Taunya's word 2026-11-21 · left: a look on a leader's and a superintendent's own phone
summary: >
  Taunya said writing someone up was not made easy enough for a leader or a superintendent from
  their Dashboard. A leader's only door was the HR Report card, 8.7 phone screens down the full
  Dashboard and folded, and a superintendent had none. The plan is one named press, Write someone
  up, on the full Dashboard, the short Dashboard and Job Mode. It opens a phone sheet: who, what
  kind, what was seen, photos, who saw it, then a read-back and one press that sends. It lands in
  the Pending reports the office already reads, with the job, the time and the facts the record
  lacked. Seven PRs, built on the HR report queue and not on the Writeups forms.
next: A leader and a superintendent each write one up on their own phone, with a photo, once with no signal and once from the short Dashboard. Then the card closes on Taunya's word.
size: L as a train of seven (S · M · S · M · M · S · S); left: a look on a real phone (XS)
ver: v2.8157, v2.8160, v2.8172, v2.8174
blocker: A leader's and a superintendent's own phone. A kept voice recording is set aside and the person's side is dropped, see *Set aside*.
opinion: your call — the train is built and live, and what is left is watching a leader use it once
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

1. **The database half (S).** Built, v2.8157, pushed 2026-11-21. The record's new facts, the superintendent's
   right to write and to read their own, the list of people and the function a send lands through. Taking one
   back and adding to one came with it, so step 7 needed no migration of its own.
2. **The press and the sheet (M).** Built, v2.8160. The kernel, the sheet, the press on the full Dashboard for a
   leader and a superintendent, spoken words, the read-back and the writer's own list. The help guide.
3. **The short pages (S).** Built, v2.8160. The same press on the short Dashboard, Job Mode and its Short view.
4. **No signal (M).** Built, v2.8160. The write-up is kept on the phone and sent when the signal is back.
5. **Photos (M).** Built, v2.8172 for the place and v2.8174 for the screens. Taken in the sheet, kept with no
   signal, shown on the office's card, one evidence record once filed. The old HR Report card went with v2.8174.
   The same change keeps a draft's words across a reload, since the first live walk met the app's *Reload* toast
   in the middle of one.
6. **The office's card (S).** Built, v2.8160. Pending reports shows the facts, and a line shows the same day.
   **Start a Writeup from it** is not built: it waits for a word that it is wanted.
7. **Add to it and Take it back (S).** Built, v2.8160.

Steps 2 to 4, 6 and 7 went in as one change. Each costs most of an hour in CI and the queue, and none ships
alone to any use.

## Set aside

- **The person's side. Dropped.** The office would press *Show it to them* on one write-up, and the person
  would read it and write their side. Taunya, 2026-11-21: *It doesn't really matter if the person who's written
  up reads it. What matters is that the company records it.* Frame 10 of the mock-up draws what is not built.
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

Walked on clicktooling.com on 2026-11-21, on the roster's `ZZ Test Hand`, at phone width:

- As a leader's sample account: the press on the first screen, the list, the search, the form, the read-back,
  the send, **Your write-ups** and the office's card with its facts and counts.
- As a dev seat, after v2.8174: a photo on the form, a reload that kept the words and dropped the photo, the
  photo on the read-back and on the office's card, and **File**, which put the entry on the file with the photo
  as its evidence record.

Walked again the same day at an iPhone's size, with touch and a phone's user agent, by a script on the live
site:

- As the leader's and the superintendent's sample accounts: the press, the search, the form with a photo, the
  read-back and the send. Each was taken back.
- As a dev seat with the signal cut: the write-up and its photo were kept on the phone, and went to HR by
  themselves when the signal came back. The app keeps nothing on the phone while View as is on, so this part
  cannot be walked as a sample account.
- In an iPhone simulator's Safari: the press on a leader's first screen, and the sheet.

Found on that walk: the *Kept on this phone* note stays on **Your write-ups** after the write-up has gone.

What the company keeps: a write-up is on the person's file from the moment it is sent, with its writer and its
day. One that is taken back stays there too, marked dismissed with the reason.

Not walked: the short Dashboard and Job Mode, and a real phone's camera and microphone in a real hand. Those
are the look that is left.

Left on that test person's file, where entries append and never change: one filed field report with its
photo, one waiting to be filed and four taken back. All say they are tests.
