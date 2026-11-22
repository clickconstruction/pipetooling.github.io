import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.8246',
  date: '2026-11-21',
  title: 'View as no longer marks things as seen for the person',
  kind: 'fix',
  highlights: [
    'A dev looking through View as no longer clears what is new for that person. Answers to their notes and plan questions stay new.',
    'The same holds for a bid request, a bid’s unread notes, a first look and a law firm’s answers.',
    'Opening a salaried person’s empty day in View as no longer syncs their clock from the dev’s browser.',
    'A button the dev presses while viewing as someone still saves as that person, as before.',
  ],
}

export default note
