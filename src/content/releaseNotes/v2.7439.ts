import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.7439',
  date: '2026-11-16',
  title: 'Lien desk: a job on public property can leave the lien path',
  kind: 'infra',
  highlights: [
    'The Lien desk now reads the answer to "Is this public property?" from the property record. Until someone answers, it keeps its guess from the owner’s names, as before.',
    'Once a property is answered public, every job at that address leaves the Board, the lists, the run, the notary print and the Dashboard’s lien counts together.',
    'Once a property is answered private, the hold a public-sounding name put on its papers opens.',
    'Nothing on a screen changes yet. The question and the window that give the answer come next.',
  ],
}

export default note
