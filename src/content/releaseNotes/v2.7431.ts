import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.7431',
  date: '2026-11-15',
  title: 'Supply houses: a house that is owed nothing takes one line',
  kind: 'feature',
  highlights: [
    'In the Supply houses table a paid house is one line now. It shows the name, then small words like 2 invoices, all paid · no job account, then what we paid and a grey $0.00. The two dashes are gone.',
    'A house that is owed keeps its whole row, with its date and They told us….',
    'Nothing is hidden. An open job account keeps its colour on the line, and a balance the house gave us that is not ours comes first. Hover the words to read all of them.',
    'On a phone a paid house is two lines where it took three.',
  ],
}

export default note
