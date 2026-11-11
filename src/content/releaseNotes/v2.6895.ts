import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.6895',
  date: '2026-11-10',
  title: 'Lien affidavit: the short form prints on one page',
  kind: 'fix',
  highlights: [
    'Print for notarization now puts the short affidavit on one sheet. Under a GC it ran a few lines over, so the last statement, the signature and the notary block printed alone on a second page.',
    'The lines sit a little closer together in print, the same spacing the PDF already used. The type is the same size and no word changed.',
    'Nothing was ever cut in half. A paper too long for one sheet still moves its last statement, signature and notary block to the next page together.',
    'An affidavit on the earlier form prints as it did.',
  ],
}

export default note
