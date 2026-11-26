import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.8623',
  date: '2026-11-26',
  title: 'Settings: the developer can clear an address the map could not place',
  kind: 'fix',
  highlights: [
    'The map keeps an address no service could place for 30 days, so it stops asking. A made-up address from a walk stood there for a month with no way out.',
    'Kept map addresses, the developer’s block in Settings → Data & recovery, now finds those misses beside the kept addresses and clears one, only when no record anywhere holds its street line.',
    'Nothing changes for the office. A miss still goes by itself when a point is saved for its address.',
  ],
}

export default note
