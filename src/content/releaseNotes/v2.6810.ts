import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.6810',
  date: '2026-11-09',
  title: 'A printed lien paper keeps the signature with its statement, and nothing of the browser prints on it',
  kind: 'fix',
  highlights: [
    'A printed lien affidavit put the last numbered statement at the foot of page 1 and the signature alone at the top of page 2. The last statement, the signature and the notary\'s block now print together on one page.',
    'The browser printed its own lines on every sheet: the date and time, the title, "about:blank" and a page count. The lien papers now leave it no room, so a paper for the county clerk carries only the paper.',
    'The same holds for the § 53.056 notice and the release of lien, and for Download PDF and the emailed PDF.',
    'If a print still shows the date and time, open "More settings" in the print window and untick "Headers and footers".',
  ],
}

export default note
