import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.5047',
  date: '2026-10-09',
  title: 'GC mode: the submittal register, for a dev',
  kind: 'feature',
  roles: ['dev'],
  highlights: [
    'A job we are building on GC projects has a Submittals button. Each awarded trade has a card with whose move each submittal is and when it is needed.',
    'Add a submittal on the trade’s own lines, record what came by email with its Drive link, and send it to the architect by email.',
    'Record the architect’s answer. Revise and resubmit sends it back to the trade for another round.',
    'Only a dev sees it while GC mode is built.',
  ],
}

export default note
