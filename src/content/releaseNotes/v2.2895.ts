import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.2895',
  date: '2026-09-05',
  title: 'Waiting lists now show their age — oldest first, amber then red',
  kind: 'fix',
  highlights: [
    'Open dispatch requests, pending HR reports and open one-off tasks now list the oldest item first, and each row carries an age chip ("3 days waiting") that turns amber, then red, the longer it sits — a 46-day request no longer looks like one from this morning.',
    'Needs You gets two new cards: dispatch requests open 3+ days (for the dispatch team) and HR field reports pending 3+ days (for devs). Each names how old the oldest one is and jumps you to the queue.',
    'Workflow expected dates that have passed now read red — "43 days late" — instead of calm blue; a step ending today shows "due today".',
    'The Field: Waiting for Approval queue says "12 days" instead of running a stopwatch past two days; the Collect Payment modal a tech is watching keeps its live count-up.',
  ],
}

export default note
