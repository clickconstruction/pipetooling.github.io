import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.5012',
  date: '2026-10-09',
  title: 'Bids: a labor row whose hours were cleared still shows what they were',
  kind: 'fix',
  roles: ['estimator', 'master_technician', 'assistant', 'controller', 'primary', 'dev'],
  highlights: [
    'A labor row with its hours cleared moves to the rows need hours list. With Past values on, its boxes there now show the earlier hours, like 2.25 h · Robert · Wed.',
    'A row brought back by a new import shows the old row’s hours there too, in italics.',
  ],
}

export default note
