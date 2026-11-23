import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.8360',
  date: '2026-11-23',
  title: 'Before we start: the Schedule look says it is reading, and a No says when no phone rang',
  kind: 'fix',
  highlights: [
    'The Development page’s Schedule look drew nothing while its first read was out, so a site still being read looked like one with no stage lines. It now reads Reading the schedule… until the cards land.',
    'A No on Is it as told? rings the dispatchers’ phones. When that ring failed, nothing said so. The card now reads The line is in the inbox, but no phone rang. Call Dispatch too. The line was always kept.',
  ],
}

export default note
