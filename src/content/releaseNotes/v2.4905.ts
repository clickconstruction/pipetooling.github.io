import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.4905',
  date: '2026-10-08',
  title: 'GC mode: the trade partner portal can read a company’s asks',
  kind: 'infra',
  roles: ['dev'],
  highlights: [
    'The portal’s rules for a company’s asks move from the GC mode prototype into the app, word for word: bidding, a job, lost or passed, its quote day, its vetting, its promises, a pre-bid meeting, its questions and the invitation.',
    'What the portal reads about one company becomes the shapes those rules read, and never carries a dollar of ours.',
    'Nothing on a screen reads them yet. The portal page comes next in the GC mode real build.',
  ],
}

export default note
