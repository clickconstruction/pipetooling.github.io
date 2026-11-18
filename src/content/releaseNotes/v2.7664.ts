import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.7664',
  date: '2026-11-17',
  title: 'Supply houses: the Accounts payable total and the two pins read one tested sum',
  kind: 'infra',
  highlights: [
    'Nothing changes on screen. Accounts payable, the Dashboard pin and the Settings pin show the figures they showed.',
    'The rule that a bill paid in part counts for what is left on it now has its own tests where the page builds its book.',
    'The page’s total and the two pins’ total are held to each other by a test.',
  ],
}

export default note
