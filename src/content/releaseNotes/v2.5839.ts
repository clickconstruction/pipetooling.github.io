import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.5839',
  date: '2026-10-25',
  title: 'Quickfill: every station leads with a Next line',
  kind: 'feature',
  roles: ['dev', 'master_technician', 'assistant', 'controller'],
  highlights: [
    'Under a station’s question, one line now names the first thing to do: Lean on TF Harper · $29,323 · 38 days, Approve Thursday’s 3 sessions · 14.2 h, Decide “Toll bill” · 23 days in the tray. Twenty stations have one. A station with nothing to say shows no line.',
    'Six stations that asked no question now do: Lost bid reasons, GC weekly review, Job follow-ups, Missing bill dates, Field photos → Drive and Needs you. Three questions a first-timer could not act on are rewritten: Warnings, Jobs Cleanup and Billed Awaiting Payment.',
    'Field photos → Drive reports its count at last, the estimates still holding photos.',
  ],
}

export default note
