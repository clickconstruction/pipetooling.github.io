import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.2289',
  date: '2026-08-25',
  title: 'Estimate cards show where to tap',
  kind: 'feature',
  highlights: [
    'Tap an estimate card where nothing is clickable and its real tap spots — the number, the title, the customer, the notes toggle — flash a blue ring for a beat, then fade.',
    'It only appears when a tap did nothing; taps that land on something just work, same as always.',
  ],
}

export default note
