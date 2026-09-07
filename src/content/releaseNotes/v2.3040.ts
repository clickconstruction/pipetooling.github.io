import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.3040',
  date: '2026-09-07',
  title: 'Safety net under the customer profile',
  kind: 'fix',
  highlights: [
    'The customer profile modal and Customer Hub load now have 4 tests pinning everything they gather — contacts, addresses, jobs, projects, bids, estimates and the GC chip — and how a missing piece degrades; no behaviour change.',
  ],
}

export default note
