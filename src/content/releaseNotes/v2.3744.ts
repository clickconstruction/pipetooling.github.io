import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.3744',
  date: '2026-09-22',
  title: 'Lien notices on a home carry the § 53.254(g) statement',
  kind: 'fix',
  highlights: [
    'Counsel confirmed the cover letter’s withholding paragraph is right on residential work, and pointed out the one thing the notice was missing: on a homestead, Texas Property Code § 53.254(g) requires a statement in or attached to the § 53.056 notice, or the lien is invalid.',
    'The notice now prints that statement, word for word, under the form on every residential or homestead-flagged property — the Lien desk, the Lien window, Put a GC on notice and its preview all print the same page. Commercial notices are unchanged.',
    'Nothing to tick: the property record’s kind and homestead flag decide it. Set the kind on the property and the right paper follows.',
  ],
}

export default note
