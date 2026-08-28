import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.2410',
  date: '2026-08-27',
  title: 'Scenario-card price copy works across GC packets',
  kind: 'fix',
  highlights: [
    'The "copy prices from …" link on an empty price scenario now works when the source scenario lives on another GC packet — before, a cross-packet source silently copied nothing.',
    'Cross-packet copies match rows by fixture name, and the toast reports how many prices matched and how many had no matching row in this packet\'s counts.',
  ],
}

export default note
