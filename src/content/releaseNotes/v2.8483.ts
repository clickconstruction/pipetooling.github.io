import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.8483',
  date: '2026-11-24',
  title: 'Takeoffs: a long assembly name no longer pushes Line total off the sheet',
  kind: 'fix',
  highlights: [
    'On Bids → Takeoffs, the small grey line under a part’s name shows its type and the assembly it came from. A long assembly name made the whole table wider than the sheet, at any window width, so Line total and the row’s buttons were pushed aside.',
    'That line now shortens with dots to fit. Hover it to read it whole.',
    'The part’s name gets more of the spare width in a wide window, so more of it shows.',
  ],
}

export default note
