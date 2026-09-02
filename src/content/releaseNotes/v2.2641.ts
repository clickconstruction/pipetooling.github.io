import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.2641',
  date: '2026-09-02',
  title: 'Lien releases: a pending signature request survives closing the window',
  kind: 'fix',
  highlights: [
    'Reopening the Release of Lien window while a signature request is out now shows the request again — the awaiting banner, Cancel request, and the signer\'s Sign now button — instead of starting a fresh form. Caught in live testing right after the signing loop shipped.',
  ],
}

export default note
