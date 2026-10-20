import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.5513',
  date: '2026-10-13',
  title: 'Job Summary: a stale job opens its own window, and the list points at the Follow-ups deck',
  kind: 'feature',
  roles: ['dev', 'master_technician', 'assistant', 'controller'],
  highlights: [
    'On Jobs → Job Summary → Cycle, pressing a row of the Stale open list now opens that job’s window, where the bill, the schedule and the status live, instead of the Jobs table filtered to its number.',
    'The list gains Review them in Follow-ups, which opens the Follow-ups deck on its Idle lens: one card per idle job with nothing booked, what it needs, a door, and Looks fine or Snooze to remember your call.',
    'The footnote says the difference: this list keeps every idle job, a visit booked or not; the deck reviews the ones with nothing booked.',
  ],
}

export default note
