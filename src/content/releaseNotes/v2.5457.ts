import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.5457',
  date: '2026-10-13',
  title: 'Messages: a place for each job’s photos switch, behind the scenes',
  kind: 'infra',
  roles: ['dev'],
  highlights: [
    'Each job can keep a switch that saves every photo that comes in to its Drive folder. It starts off on every job.',
    'Only the office turns it on or off, and the app keeps who did it and when.',
    'A picture on a text that the app could not copy is marked, so the line still says a picture came.',
    'Nothing on screen changes yet.',
  ],
}

export default note
