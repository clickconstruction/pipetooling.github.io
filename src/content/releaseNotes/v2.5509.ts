import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.5509',
  date: '2026-10-13',
  title: 'Hours: a salaried person who clocks in before their start keeps that punch as their day',
  kind: 'fix',
  roles: ['dev', 'master_technician', 'assistant', 'controller'],
  highlights: [
    'When someone on a salaried workday clocks in by hand before their start time, the app no longer adds the scheduled session on top of it at the start time.',
    'The team strip stops showing that day twice with the Overlap chip, and the hours it sums are the punch alone.',
    'A punch that ended before the start time changes nothing: the day opens and closes as before.',
  ],
}

export default note
