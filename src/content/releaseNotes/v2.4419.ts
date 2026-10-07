import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.4419',
  date: '2026-10-02',
  title: 'Bids: groundwork for a call-again date on a bid',
  kind: 'infra',
  highlights: [
    'The database can now hold the day to call a GC again, who to ask for, and what the bid is waiting on.',
    'Nothing changes on screen yet. The Call queue starts asking for the date in the next release.',
  ],
}

export default note
