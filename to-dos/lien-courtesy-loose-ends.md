---
name: "Lien desk: the courtesy notice's loose ends after the sweep"
number: 249
group: waiting
status: proposed 2026-11-02 from a read of v2.6259–v2.6271 and v2.6340 after Taunya's report on job 890 · six rows, each with its own call
summary: >
  The courtesy notice train shipped on 2026-11-02 and the sweep read it for defects. Three small ones
  are fixed (PRs #6851 and #6852). Six more need a decision or data that is not wired yet: a second press
  after a failed record sends everything twice, the amount it names, the reply that never closes it,
  the delivery day letter two never reads, a record write that can lose another screen's record, and
  the GC thread's grey line the release note promised.
next: The owner reads the six rows and marks each build, later or drop. The double send goes first.
size: S for the double send and the GC's grey line · S for the delivery day · M for the reply · the amount is a one-line call
blocker: The owner's call per row; the reply needs a reader of Messages lines after the last send.
ver: v2.6259 · 6261 · 6269 · 6271 · 6340
opinion: build the double send and the delivery day now; name the amount's rule in the guide and leave the code; the reply when Messages has a per-job reply reader; the GC's grey line with the next Messages PR.
mockup: not required — every row changes a rule or a record, no screen
---

# Lien desk: the courtesy notice's loose ends after the sweep (#249)

## The ask

After Taunya's report on job 890 (v2.6376, v2.6380), the sweep read the courtesy notice train
(punch list #231's four PRs and #243's first) for defects. The words that did not follow the state
are fixed in v2.6382; the clock that no longer closed on the owner's call after letter two went is
fixed in v2.6383. Six rows remain. Each has its own call.

## The rows

1. **A second press after a failed record sends everything twice.** `sendCourtesyNotice` sends the
   emails and texts first, then writes the record on the sent item. When that write fails, the window
   stays open with its counted Send button live, the toast names only the write's failure, and no
   History line exists; a second press sends every message again. Fix: on a failed record after a
   send, close the window, say *N messages went; the record could not be written: <reason>*, and
   offer *Write the record again ›* that writes without sending.
2. **The amount the courtesy names.** The window sums every open billed invoice on the job today
   (`payPage.rows`), bills raised after the notice included, and the email reads *$X for work in
   {months}… unless the $X is paid, we will file*. The guide promises *one number, the notice's claim*.
   Call: name the notice's claim, or keep the job's open billed total and say so in the guide.
3. **A reply never closes it.** (Also #262's call 2, a reply moving the Reminders strip's row to Closed, since that card closed 2026-11-07.) `courtesyStatus` closes on `repliedAt`, and nothing passes it
   (`courtesyByJobFrom` has no reader of Messages lines after the last send). The GC or the owner
   answering in Messages keeps the press live. Needs a per-job read of inbound lines newer than the
   last courtesy, on the GC's and the owner's contacts.
4. **Letter two never reads the delivery day.** `letterTwoStatus` takes `mailClocks` (USPS accepted ·
   delivered, from the Docsmit piece) and no caller passes them; day 0 is always `sent_at`. The guide
   says the desk uses the delivery day when the piece knows it. Fix: build the clocks from
   `mailPiecesByItem` in `useLienDeskData` (the owner's piece) and pass them, or amend the guide.
5. **The record write can lose another screen's record.** `withCourtesyRecord(item.fields)` writes
   the whole `fields` object as the window captured it; an owner's call, the GC's okay or another
   courtesy recorded in between is overwritten, and the History trigger keys lines by array index.
   Rare (two people on one job in the same minute). Fix: re-read the item's `fields` just before the
   write, or move the record to its own rows.
6. **The GC's thread has no grey line.** Release note v2.6269 says both threads show the courtesy as a
   grey line; the push adds only the owner's (`messagesReplyPush.ts`, `recipient: 'owner'`). The
   fragment claims the owner's alone. Fix: add the GC's line, or correct the note.
