import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.4758',
  date: '2026-10-07',
  title: 'Pipeline: a Collections job with no bill line says how long it has sat there',
  kind: 'fix',
  highlights: [
    'A job parked in Collections with nothing on a bill line now wears the amber pill: In Collections N days · no bill line, with the day it was flagged in its hover.',
    'The pill was written in v2.2913 but only ever reached the Billed section, where a Collections job never sits.',
    'The They said… door beside it records the payment date the customer named, as it does on a Billed row.',
  ],
}

export default note
