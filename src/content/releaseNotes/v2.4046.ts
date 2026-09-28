import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.4046',
  date: '2026-09-28',
  title: 'GC Review: Find a check',
  kind: 'feature',
  roles: ['dev', 'master_technician', 'assistant', 'controller'],
  highlights: [
    'The GC is on the phone asking what you put #48211 against. Open their row, Share → Find a check…, and type the number, the amount or the day it came in.',
    'The answer reads as a sentence: where the check sits now, one line per job and bill, then any move it made since it was recorded — "$12,000.00 moved from Maple Ct to Oak Ridge Ph 2 on Sep 26".',
    'Before you type, the newest checks show. A check recorded without its number wears a "no number" chip and is found by its amount or its day.',
  ],
}

export default note
