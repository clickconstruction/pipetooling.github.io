import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.5483',
  date: '2026-10-13',
  title: 'Messages: see whether they opened their portal after we sent them a link',
  kind: 'feature',
  roles: ['dev', 'master_technician', 'assistant', 'controller', 'estimator'],
  highlights: [
    'A link to their portal on a message we sent says how often they opened their portal since, and when last.',
    'It counts their portal, never the one file, since a portal’s visits are the whole portal’s.',
  ],
}

export default note
