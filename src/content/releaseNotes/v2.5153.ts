import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.5153',
  date: '2026-10-10',
  title: 'GC mode: our own crew from its Pipeline job',
  kind: 'feature',
  roles: ['dev', 'master_technician', 'controller'],
  highlights: [
    'On Draws, a trade our own crew does on a GC job can name its Pipeline job. Its stages there give our crew’s percent, each with the day it was reported.',
    'The daily log shows how many of our people clocked in on that job each day. It is a number only, and nobody types over it.',
    'Bill the customer says where our own crew’s percent came from: the job’s stages, its crew report or its own percent.',
  ],
}

export default note
