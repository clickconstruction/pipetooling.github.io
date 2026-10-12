import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.5277',
  date: '2026-10-12',
  title: 'Messages: the step card and the reminders read the real flow',
  kind: 'fix',
  roles: ['dev'],
  highlights: [
    'Groundwork for the flows in Messages. Nothing changes on screen yet.',
    'A step whose paper ran out still shows the day it was done.',
    'No reminder goes for a quote or a round nobody has asked for yet.',
  ],
}

export default note
