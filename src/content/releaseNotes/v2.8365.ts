import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.8365',
  date: '2026-11-23',
  title: 'Dashboard: a name on the texts row stays on one line',
  kind: 'fix',
  highlights: [
    'On a phone, the Needs you row for texts to send could split a name across two lines. The first name ended one line and the last name began the next.',
    'A name now stays whole. When the names do not fit one line, the line breaks at the dot between two names.',
  ],
}

export default note
