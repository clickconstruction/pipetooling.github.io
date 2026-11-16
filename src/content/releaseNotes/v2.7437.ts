import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.7437',
  date: '2026-11-16',
  title: 'Lien papers: the signature prints the day, with no time and no line of how it was signed',
  kind: 'feature',
  highlights: [
    'A signed lien paper now reads Signed November 16, 2026. The time and CT are gone from the notice, its owner and GC copies, the cover letter, the retainage notice and the run’s packet.',
    'The grey sentence that said how it was signed, by whom and on whose screen is no longer printed. The signature, the name, the record code and the line about electronic signatures stay.',
    'A lien release and a waiver follow the same rule, on the page, the PDF, the email and the copy enclosed with a notice.',
    'Nothing is lost. The Lien desk shows the full signing record under the notice, and the Release of Lien window shows it for a release.',
  ],
}

export default note
