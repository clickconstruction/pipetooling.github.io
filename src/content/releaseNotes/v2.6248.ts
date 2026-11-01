import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.6248',
  date: '2026-10-31',
  title: 'The record check starts clean when the day changes (punch list #220)',
  kind: 'fix',
  highlights: [
    'In Swear a statement…, changing the day it is about clears What the record says while it reads again. The old day’s line no longer sits under the new heading.',
    'A signed statement’s record check now says it is not read again, instead of asking for a day already picked. Its name line reads as on the signed paper.',
  ],
  roles: ['dev', 'master_technician', 'assistant', 'controller'],
}

export default note
