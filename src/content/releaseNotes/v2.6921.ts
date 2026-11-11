import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.6921',
  date: '2026-11-10',
  title: 'Merge two copies of a part into one',
  kind: 'feature',
  highlights: [
    'Duplicate Materials can now merge. Press Keep this one on the part that should stay, and the other copies go into it.',
    'Every price, assembly, takeoff line, purchase order line and house number moves to the part that stays. Nothing is lost.',
    'A new view, Same model number, finds copies whose names differ but whose model number is the same.',
    'Press Not the same part on two parts that only look alike, and they are not offered together again.',
  ],
}

export default note
