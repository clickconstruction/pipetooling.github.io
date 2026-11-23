import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.8380',
  date: '2026-11-23',
  title: 'State roll: a place for our notes on a licensed plumber, and Leave off',
  kind: 'infra',
  highlights: [
    'The database can now keep the office’s own notes on a person on the state’s roll. A note stays when the person drops off the roll and comes back.',
    'A person who asks not to be listed can be left off the roll, and put back later.',
    'Nothing on screen changes yet. The Everyone view and each person’s sheet come next.',
  ],
}

export default note
