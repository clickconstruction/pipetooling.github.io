import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.3026',
  date: '2026-09-07',
  title: 'Safety net under IP map pins',
  kind: 'fix',
  highlights: [
    'The map pin a clock punch or estimate view gets from its IP address now has 6 tests pinning which addresses show a pin, how the lookup is cached, and how failures read; no behaviour change.',
  ],
}

export default note
