import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.8317',
  date: '2026-11-22',
  title: 'State roll: an agent can check a plumbing license against the state’s own files',
  kind: 'fix',
  highlights: [
    'An agent asked to check a plumbing license number used to be told the plumbing board keeps no open list. That was wrong. The board publishes every license as free files.',
    'The agent now reads the board’s file for that level and answers with the holder, whether the license is current, the day it was issued, the day it expires and its endorsements.',
    'It reads one number at a time and keeps nothing. It gives no address, ZIP or phone.',
    'Nothing changes on People → Licenses or on Prospects → State roll.',
  ],
}

export default note
