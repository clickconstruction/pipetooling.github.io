import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.5797',
  date: '2026-10-23',
  title: 'Messages: the flow rail waits until the sender is named',
  kind: 'fix',
  roles: ['assistant', 'controller', 'estimator', 'master_technician', 'dev'],
  highlights: [
    'A thread for a number or an address nobody has named no longer shows the flow rail on its right. Its one step only repeated the question the pill beside the name and the sort card already ask.',
    'The rail comes back the moment Who is this? names the person, with the flow for what they are to us.',
  ],
}

export default note
