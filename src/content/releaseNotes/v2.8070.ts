import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.8070',
  date: '2026-11-20',
  title: 'Before we start: a long list of bullets is read whole',
  kind: 'fix',
  highlights: [
    'A site with more than 1,000 bullets lost its newest ones on the Development page. Those stages read as having no list yet.',
    'Every bullet, yes, ask, day, decision and arrival is now read, however many a site holds.',
    'The Dashboard line for answers customers owe us no longer goes missing when many jobs have open bullets.',
  ],
}

export default note
