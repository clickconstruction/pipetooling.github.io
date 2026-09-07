import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.3000',
  date: '2026-09-07',
  title: 'Safety net under the invoice memo presets',
  kind: 'fix',
  highlights: [
    'The memo presets on Bill Customer — the shipped Standard and Alternate, your own additions, and the default that opens — now have 19 tests pinning how they are stored, shared across devices and recognised; no behaviour change.',
  ],
}

export default note
