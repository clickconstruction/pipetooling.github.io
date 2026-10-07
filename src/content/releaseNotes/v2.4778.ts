import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.4778',
  date: '2026-10-07',
  title: 'Court areas: a record with no county takes the area’s',
  kind: 'fix',
  highlights: [
    'When the nightly classification places a property record that has no county on file, it now fills the county from the area the address fell in, and the record says the county came from the office’s court map.',
  ],
}

export default note
