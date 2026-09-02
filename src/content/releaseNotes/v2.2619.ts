import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.2619',
  date: '2026-09-02',
  title: 'Lien releases: request the signature, sign in the app',
  kind: 'feature',
  highlights: [
    'The Release of Lien window now saves itself as a draft while you work — no Save button, no Cancel, just close it and pick the draft back up later.',
    'A new "Request signature" button sends the release to the master plumber, who signs right in the app — typed in a signature script or drawn with a finger — and the signature prints on every copy with a signed-electronically stamp.',
    'Printing, downloading, or requesting a signature now records the release on the job automatically, so every release you produce stays findable forever. "Print" became "Print for signature" until a release is signed.',
    'Copy for email is gone on purpose: a signed release is effectively a contract, so it leaves the app only as the fixed PDF or printed letter.',
  ],
}

export default note
