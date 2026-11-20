import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.7948',
  date: '2026-11-19',
  title: 'Your hours and Utilization read a salaried person’s own week',
  kind: 'fix',
  highlights: [
    'Your hours on My Time tells a salaried person their own week, like 36 h at 8 h Mon to Thu and 4 h Fri, instead of 40 hours.',
    'People → Utilization measures each salaried person against the week their pay sets, and shows its days.',
    'A day off in a set week comes out at that day’s hours.',
    'A salaried person who clocks real hours is read against their set week until someone draws them a week.',
  ],
}

export default note
