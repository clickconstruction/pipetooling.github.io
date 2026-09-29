import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.4128',
  date: '2026-09-29',
  title: 'Pipeline: the Crew & Dates column has room again',
  kind: 'fix',
  roles: ['dev', 'master_technician', 'assistant', 'controller'],
  highlights: [
    'The Crew & Dates column on Jobs → Pipeline is half again as wide, and the two-week strip’s cells grew with it. A job’s DONE and BILL lines fit on two lines each instead of three, so the cell is about half as tall as before.',
    'The crew reads as one line — the first two names and “+1” for the rest — instead of one name per line. The line still opens everyone on the job with their hours.',
    'The DONE line says what its date was — “4 weeks ago · worked” or “booked, no hrs” — the same words the Not scheduled line uses, instead of “last visit”.',
  ],
}

export default note
