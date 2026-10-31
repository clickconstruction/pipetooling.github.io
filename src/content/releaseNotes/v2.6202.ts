import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.6202',
  date: '2026-10-31',
  title: 'Messages: A notice, not a person',
  kind: 'feature',
  highlights: [
    'The Who is this? card on an email now ends with A notice, not a person. One press marks the address a notice: the row leaves New, the thread goes to Done with a grey line, and the app leaves that address out from now on. A second press marks everything from the company’s own domain, never offered for a shared mail service.',
    'Nothing in Gmail changes. Search still finds the thread, and the Who is this? pill still lists it. Their next email stays in Gmail with no label.',
    'Pressed by mistake? The thread shows Marked a notice with Not a notice after all. One press takes them off the list and puts the row back in New.',
    'Sort all walks the block like every other press, so a morning of notices is one press each.',
  ],
}

export default note
