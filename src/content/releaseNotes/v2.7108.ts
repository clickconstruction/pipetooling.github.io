import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.7108',
  date: '2026-11-12',
  title: 'An HR summary or narrative says when each section last changed',
  kind: 'feature',
  highlights: [
    'On People → HR → Documents, press When each section last changed under the summary or the narrative.',
    'Each section shows the day it took the words it has now, and how many entries were written since.',
    'The count turns amber when one of those entries cites the section, so you know to read it again.',
  ],
}

export default note
