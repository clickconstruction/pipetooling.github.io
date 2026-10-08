import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.4965',
  date: '2026-10-08',
  title: 'People: the Hours tab’s session search filters inside its own section',
  kind: 'infra',
  roles: ['dev'],
  highlights: [
    'Behind the scenes, the code that narrows the Hours tab’s four session lists to your search moved into the sessions section itself.',
    'Nothing changes on screen. The search still stays put when you move between weeks.',
    'New tests cover the search on all four lists, the no-match line and Clear.',
  ],
}

export default note
