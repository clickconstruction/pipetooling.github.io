import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.3013',
  date: '2026-09-07',
  title: 'Safety net under the Wheels report',
  kind: 'fix',
  highlights: [
    'The Wheels report on People — fuel by person, truck running costs, and the per-field-hour rates — now has 8 tests pinning what it gathers, which charges count as fuel, and a hand-checked set of numbers; no behaviour change.',
  ],
}

export default note
