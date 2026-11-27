import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.8741',
  date: '2026-11-27',
  title: 'The material location report stays closed after you close it',
  kind: 'fix',
  highlights: [
    'Print the material location report on a site’s materials screen opens the paper on the site’s page.',
    'After Close, the page’s address still asked for the paper. So a reload, or the link sent to someone, opened it again.',
    'Close now clears that from the address. Back still returns to the materials screen.',
  ],
}

export default note
