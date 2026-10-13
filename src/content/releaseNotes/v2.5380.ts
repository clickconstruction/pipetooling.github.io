import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.5380',
  date: '2026-10-12',
  title: 'Messages: turn on reading the bids inbox from Settings',
  kind: 'feature',
  roles: ['dev', 'master_technician'],
  highlights: [
    'Settings → Phone and texts has a Read bids@ switch for the owner and a dev. It asks before it turns the reader on.',
    'On, the app reads new email in the bids inbox every 3 minutes and puts each one on its sender’s thread.',
    'The card says when the inbox was last read, and the problem’s own words when a read stops.',
  ],
}

export default note
