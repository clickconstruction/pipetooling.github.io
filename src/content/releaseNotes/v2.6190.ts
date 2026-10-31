import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.6190',
  date: '2026-10-30',
  title: 'Coloured buttons, chips and counts read in dark mode',
  kind: 'fix',
  highlights: [
    'In dark mode, many blue, red, green, violet and amber buttons turned pale under their white words, so the words barely showed. Picked chips, small counts and check marks did the same. They now keep the deep colour they have in light mode, under the same white words.',
    'Some buttons had dark words on the pale colour in dark mode instead. They are back to white words on the deep colour, like every other coloured button.',
    'That covers the contract, lien and billing buttons in the job window, Mark lost on Edit Bid, the lien timeline, the GC review steps, the Bids mode switch, the Help guides and more. Light mode looks the same, except a few lighter blue and green buttons that now take the deeper shade so their words read there too.',
  ],
}

export default note
