import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.6896',
  date: '2026-11-10',
  title: 'Lien window: it says when an affidavit needs a second page',
  kind: 'feature',
  highlights: [
    'When an affidavit or a release is too long for one sheet, a line under Print for notarization now says so before you print.',
    'It reads: This paper prints on 2 pages. The last statement, the signature and the notary’s block moved to page 2 together, so none of it is cut.',
    'A paper that fits on one sheet shows no line.',
    'The count comes from laying the paper out at the printer’s size. On a paper of three pages or more it can be a line off.',
  ],
}

export default note
