import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.8104',
  date: '2026-11-20',
  title: 'The app’s first file is smaller again: six more windows load when they are opened',
  kind: 'infra',
  highlights: [
    'The file every visit loads first is now less than half the size it was this morning.',
    'The bid preview, the customer profile, the person desk, the user review, the painted map and the edit customer form load when you open them.',
    'A window whose code is already on the device opens at once, with no loading step.',
    'A window that failed to load is asked for again the next time you open it.',
  ],
}

export default note
