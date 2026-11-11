import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.6930',
  date: '2026-11-11',
  title: 'Lien desk: the batch print says when an affidavit takes a second sheet',
  kind: 'fix',
  highlights: [
    'Under Print N for notarization on the Affidavits list, a line now names each affidavit that takes a second sheet, by its job.',
    'It says what moved to page 2, in the same words the job\'s own Lien window shows under its print press.',
    'The press still prints every ready affidavit. Keep a flagged paper\'s sheets together for the notary, or print it alone from its Lien window.',
  ],
}

export default note
