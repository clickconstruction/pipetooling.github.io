import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.6953',
  date: '2026-11-11',
  title: 'Lien affidavits print with a help sheet, and a guide copy to learn from',
  kind: 'feature',
  highlights: [
    'Print for notarization now prints a help sheet first: what goes in each blank, when to stop and call the office, and what to do after the notary. The help sheet is never filed.',
    'Printing a batch from the Affidavits list puts one help sheet in front, with a row for each paper and boxes to tick: signed, sealed, filed, in the app, copies mailed.',
    'Print a guide copy, in the Lien window, prints the paper with a numbered mark beside each blank. It is for learning and is never signed or filed.',
    'Untick Print the help sheet first to leave the sheet off. The choice is kept on that computer.',
  ],
}

export default note
