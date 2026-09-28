import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.4089',
  date: '2026-09-28',
  title: 'Procurement log update: the product gets its own line',
  kind: 'fix',
  roles: ['dev', 'master_technician', 'assistant', 'estimator', 'controller'],
  highlights: [
    'On the printed procurement log update each item is two lines: the tag with its dates across the first, the product (and the house, when known) on the second. A long product name no longer squeezes the dates into a narrow column.',
  ],
}

export default note
