import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.8424',
  date: '2026-11-23',
  title: 'Bills sent: an email with no answer says how long it has been',
  kind: 'fix',
  highlights: [
    'An email whose mail server never answered used to read “has not answered yet” for weeks. After two days it now says how many days have passed with no answer.',
    'On a bill that is still open, the line adds Check the address, since a mistyped address is the usual cause.',
  ],
}

export default note
