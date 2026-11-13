import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.7181',
  date: '2026-11-13',
  title: 'Lien window: the third tab is named Lien affidavit',
  kind: 'fix',
  highlights: [
    'The Lien window’s third tab now reads Lien affidavit. It read Mechanic’s lien, while the billed row, the line above the tabs and the Lien desk all call that paper the affidavit.',
    'Only the tab’s name changed. The affidavit itself prints the same words as before.',
    'The help guides that name the tab say Lien affidavit too.',
  ],
}

export default note
