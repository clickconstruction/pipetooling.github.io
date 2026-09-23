import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.3792',
  date: '2026-09-23',
  title: 'Pipeline dates say how far away they are',
  kind: 'feature',
  highlights: [
    'Every dated line on a Pipeline row now shows the calendar date and, under it, how far that is from today — NEXT Wed Sep 23 over “tomorrow · 8 AM–4 PM”, ENDS Fri Sep 25 over “in 3 days · 2 visits”, LAST Thu Sep 17 over “6 days ago · worked”.',
    'The old “b: T+2 (mon)” line reads BILL Mon Sep 21 over “2 days ago · sent” (or PAID when the latest event is a payment), and a job with no billing yet no longer carries an empty “b: —” line. The phone cards say “billed 2 days ago” and “→ Fri Sep 25 · in 3 days”.',
    'The Job Summary header’s j: and b: lines become FIELD and BILL in the same words. The T+2 codes are still there when you hover a line.',
  ],
}

export default note
