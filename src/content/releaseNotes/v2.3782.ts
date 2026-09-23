import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.3782',
  date: '2026-09-23',
  title: 'Lien desk: months down, papers across',
  kind: 'feature',
  highlights: [
    'The pane’s months card is now a grid of the whole job: one row per month worked, oldest first, with its window (mail by Oct 15 · 22 days left, closed Sep 15 · not noted, skipped and why, not a work month yet), one column per § 53.056 notice that went out — the run’s or one recorded by hand — lettered A, B…, and this notice as the last column, whose checks are the ticks you already use.',
    'A check is a paper that names the month; “✓ as information” where the paper went out after the month’s window closed. Each paper’s header says when it went out, what it claimed and with which other jobs, how it was sent, and links the saved copy.',
    'The red strip above the card and the “Earlier months” dots are gone: a closed month is a row with the loss in words and Note it as missed right there; a skipped month shows who skipped it and why. The claim, the retainage line and the affidavit’s state sit under the grid.',
  ],
}

export default note
