import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.1926',
  date: '2026-08-20',
  title: 'Mark the payment date a customer promises',
  kind: 'feature',
  highlights: [
    'When a customer names a real payment date ("the check run is on the 25th"), mark it on the billed row — the chip turns green and shows who recorded it.',
    'A promise overrides the statistical estimate on the board and in the payment forecast; if the date passes unpaid, the chip flips to "N days past promise".',
    'Clear or edit a promise any time from the same link.',
  ],
}

export default note
