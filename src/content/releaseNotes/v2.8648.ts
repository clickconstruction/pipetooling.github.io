import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.8648',
  date: '2026-11-26',
  title: 'Lien desk: the releases ride the run',
  kind: 'feature',
  highlights: [
    'The Lien desk’s run has a card named Releases. It lists every saved release of a filed lien under what it needs next: print for the notary, at the notary, record at the county, or send the copies.',
    'One press prints every ready release for the notary, a release a sheet. Its words carry the count, like Print 3 releases for the notary. A release whose bills owe again, or whose check came back, is held with the reason and the rest print.',
    'The day a release was notarized and the day its stamped copies were sent are values typed where they sit. Record the county’s stamp opens the release’s own tab.',
    'In Payoffs, a place now stays in the open list until its copies are out. The card’s Copies sent stop is lit until you type the day on the card or in the run.',
  ],
}

export default note
