import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.5692',
  date: '2026-10-20',
  title: 'Bids: splitting without copying prices really leaves the new bid unpriced',
  kind: 'fix',
  roles: ['estimator', 'assistant', 'master_technician', 'dev'],
  highlights: [
    'On an unsplit bid, the Split into two versions window could hand the new bid a starred copy of every price even with "Copy all this bid\'s prices" unticked.',
    'The split now honors the box: unticked, the first bid keeps the prices and the new one starts unpriced — the Pricing tab offers your books from its start panel.',
    'The window also says so while you decide: a line under the checkbox follows it, naming which bid keeps the prices either way.',
  ],
}

export default note
