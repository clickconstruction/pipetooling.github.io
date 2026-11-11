import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.6957',
  date: '2026-11-11',
  title: 'Lien affidavits: the county prints, held papers stay out of the batch, and the help sheet says what the app checked',
  kind: 'feature',
  highlights: [
    'Signed in, beside each print press, holds the county where the affidavit is signed. The paper prints it on both county lines, so nobody writes the property’s county there by mistake. Set the usual county in Settings, and type over it when you sign somewhere else.',
    'Print N for notarization no longer prints a ready affidavit that has a hold, such as a public owner or a homestead. The help sheet lists it as not printed, with the reason.',
    'The help sheet now says what the app checked on each paper: the owner, the homestead mark and the notice behind each month. A paper with a question says ASK FIRST.',
    'With the county printed, the help sheet lists four things to write instead of six blanks.',
  ],
}

export default note
