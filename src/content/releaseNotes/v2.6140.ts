import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.6140',
  date: '2026-10-30',
  title: "A write-up's attendance card shows ninety days of dots, each late sized by its minutes",
  kind: 'feature',
  highlights: [
    'On People → Paperwork → Writeups, pick one person in Subject and the attendance card draws their last ninety days as a strip. A ring is a scheduled day clocked on time, an amber dot a late day sized by its minutes past the grace, a red diamond a no-call no-show, a grey slash an excused late. The last thirty days are shaded.',
    'Press any dot for its receipt: the block’s start, the first clock-in, the minutes past the 15-minute grace, and who excused it when someone did.',
    'The counts are chips at the card’s head, late with its excused, NCNS, on time of scheduled, and each keeps its words on hover. Start a tardiness write-up now lists each late as its own line, with its block and its minutes, instead of a sentence of dates.',
    'A salaried person’s strip marks no day late or on time and says why: their sessions are made at schedule time.',
  ],
  roles: ['master_technician', 'assistant', 'controller'],
}

export default note
