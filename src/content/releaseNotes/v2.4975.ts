import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.4975',
  date: '2026-10-08',
  title: 'Map: a pin that lands in another country is not kept',
  kind: 'fix',
  roles: ['dev', 'master_technician', 'assistant', 'controller', 'estimator'],
  highlights: [
    'A short or unclear address could be pinned on the far side of the world. One property record was pinned in India in September, so it had no county and no court.',
    'A pin outside the lower 48 states now counts as not found. It is not saved, and the next map service is asked instead.',
    'A wrong pin already saved is looked up again. The night does it for every property record, and a good answer replaces the old pin.',
  ],
}

export default note
