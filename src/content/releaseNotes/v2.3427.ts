import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.3427',
  date: '2026-09-14',
  title: 'Map pins from an IP: the app and the server now check the same list',
  kind: 'fix',
  highlights: [
    'The rule that decides whether a clock punch or estimate view gets a map pin (public address yes, private or office-network address no) is now tested to match on both sides, so a pin never shows for an address the lookup would refuse.',
  ],
}

export default note
