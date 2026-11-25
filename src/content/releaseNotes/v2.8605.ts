import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.8605',
  date: '2026-11-25',
  title: 'The bids of the day: the ground under the Clock out list',
  kind: 'infra',
  highlights: [
    'Nothing changes on screen yet. This is the first step of the list that will fill itself in at clock out for anyone who works on bids.',
    'The database can now keep which bid was in front while a person was at work on it, and the list of bids a person leaves at clock out.',
    'A person reads their own. The owner and a dev read the first. Whoever approves hours reads the second.',
  ],
}

export default note
