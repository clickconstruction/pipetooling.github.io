import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.3811',
  date: '2026-09-24',
  title: 'GC review: the Dashboard card counts the same GCs the modal does',
  kind: 'fix',
  highlights: [
    'The Needs You card’s “N of M GCs certified” now counts a billed job under its GC only when the GC is the one paying it — the rule the GC Review window already used — so certifying every group in the window no longer leaves the card one short.',
    'A job billed to the customer with a GC on file (Johnny Ingram’s Faucet and Drains) was the one the card kept counting against the GC.',
  ],
}

export default note
