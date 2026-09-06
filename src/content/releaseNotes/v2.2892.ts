import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.2892',
  date: '2026-09-05',
  title: 'Superintendents see who is busy elsewhere, and a true manpower count',
  kind: 'fix',
  highlights: [
    'On the Schedule board a superintendent now sees a grey "busy" block on any person-day booked on work outside their projects — no job name or times, just that the person is not free.',
    'Expected Manpower shows the true total first, then the part on your projects ("83 person-hours · 38 on your projects"), for the day and for the week.',
    'The "off" (not coming in) button, its undo chip, and the picker\'s "not coming in" option only appear for roles the server accepts — superintendents no longer get a button that fails every time.',
    'Office roles (dev, master, assistant, controller) see no change.',
  ],
}

export default note
