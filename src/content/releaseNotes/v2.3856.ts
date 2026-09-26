import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.3856',
  date: '2026-09-26',
  title: 'Bids → Pricing: the scenario loader has a home of its own',
  kind: 'fix',
  highlights: [
    'The read that fetches a price scenario’s entries, assignments, custom prices and hides — and, for an alternate on another bid version, that version’s own count rows — moves out of the Pricing tab into a small tested module. The rule that decides which rows to read is now pinned by tests, including the legacy case of an unversioned scenario.',
    'Nothing on screen changes; every number reads as before.',
  ],
}

export default note
