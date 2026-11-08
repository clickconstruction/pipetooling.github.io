---
name: "Lien desk: a reply in Messages closes the courtesy notice (the loose end the sweep left)"
number: 249
group: ready
status: proposed 2026-11-02 from a read of v2.6259–v2.6271 and v2.6340 after Taunya's report on job 890, six rows · the owner took the recommendations 2026-11-07 and v2.6669 settled five (rows 1, 4 and 6 built, row 2 in the guide, row 5 dropped) · left: row 3, a reply closes the courtesy
summary: >
  The courtesy notice train shipped on 2026-11-02 and the sweep read it for defects. Five of its six rows
  are settled (v2.6669): a second press after a failed record no longer sends everything twice, the
  attorney's letter's clock reads the delivery day, the GC's thread has its grey line, the amount's rule is
  in the guide, and the record-overwrite race was dropped as never seen. One row stands: a reply in
  Messages never closes the courtesy, because nothing reads the inbound lines after the last send.
next: Build row 3 — in useLienDeskData, one read of inbound Messages lines newer than each sent notice's last courtesy on the GC's and the owner's contacts, handed to courtesyStatus as repliedAt; the guide's *What closes it* then says a reply closes it. Then delete this file.
size: M (one read in the desk's hook, the kernel already closes on repliedAt, the Reminders strip's row follows)
blocker: None. The contacts to read are the ones the press texts or emails (lienCourtesyIo finds them); a reply on a thread the office never texted from is the open question.
ver: v2.6259 · 6261 · 6269 · 6271 · 6340 · 6669
opinion: build — the guide and #262's call 2 both expect it, and the desk already carries every input but the read
mockup: not required — a rule and a record, no screen
---

# Lien desk: a reply in Messages closes the courtesy notice (#249)

## The ask

After Taunya's report on job 890 (v2.6376, v2.6380), the sweep read the courtesy notice train
(punch list #231's four PRs and #243's first) for defects. The words that did not follow the state
were fixed in v2.6382; the clock that no longer closed on the owner's call after letter two went in
v2.6383. Six rows remained; the owner marked them on 2026-11-07 and v2.6669 carried five.

## The row left

**A reply never closes it.** `courtesyStatus` closes on `repliedAt`, and nothing passes it
(`courtesyByJobFrom` has no reader of Messages lines after the last send). The GC or the owner
answering in Messages keeps the press live, and the Reminders strip's row stays on step 1 (#262's
call 2, moved here when that card closed on 2026-11-07). Needs a per-job read of inbound lines
newer than the last courtesy, on the GC's and the owner's contacts — the contacts
`loadCourtesyRecipients` finds, so the read and the send agree on whose answer counts.

## Settled 2026-11-07 (v2.6669)

1. **A second press after a failed record sent everything twice.** Built: the record's failure comes
   back on the result, the window closes, and the footer offers *Write the record again ›*, which
   writes the record alone.
2. **The amount the courtesy names.** Settled in the guide: what the job's bills still owe today,
   the notice having claimed the whole balance (v2.3821).
4. **Letter two never read the delivery day.** Built: the sent packets' pieces are read, in light
   mode too, and the clock counts from delivery or USPS acceptance when the piece knows.
5. **The record write can lose another screen's record.** Dropped: never seen; a re-read before the
   write is the fix if it is.
6. **The GC's thread had no grey line.** Built: `legalSendsForCustomer` adds the GC's copy on the
   jobs the customer is the GC of; `messages-notify` redeployed.

## How to verify

On a ZZ Test job with a sent notice and a GC in Messages: reply from the GC's number after a courtesy
went; the footer should read *closed* and the Reminders strip's row should leave step 1.
