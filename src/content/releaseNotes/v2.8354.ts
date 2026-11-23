import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.8354',
  date: '2026-11-23',
  title: 'Agreements: every paper with an outside company is on the list',
  kind: 'feature',
  highlights: [
    'Documents → Agreements now lists a W-9 or a certificate that is with an outside company. A second tag says what it is.',
    'A paper that was made and never sent is on the list too. It reads not sent, under a Not sent chip.',
    'Send starts its first send from its line. The leader and a dev can take it back there.',
    'Someone on no list has no page of their own, so this is where their papers are found.',
  ],
}

export default note
