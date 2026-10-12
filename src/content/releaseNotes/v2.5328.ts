import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.5328',
  date: '2026-10-12',
  title: 'GC mode: a statement of work email reaches a Spanish-speaking company',
  kind: 'fix',
  roles: ['dev'],
  highlights: [
    'Sending a statement of work to a company that reads Spanish now sends its email in English, as the other trade emails do while Spanish waits for its reader.',
    'Before, the statement of work reached their portal but its email was held, with a note that it did not go.',
  ],
}

export default note
