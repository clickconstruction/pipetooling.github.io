import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.7141',
  date: '2026-11-13',
  title: 'The Bridge’s Monday email leaves out what the Bridge leaves out',
  kind: 'fix',
  highlights: [
    'The Monday email now reads the list you set on the Bridge. A development, a customer or an address you left out is in none of the email’s counts.',
    'Before this, the email counted every job, bid and estimate, so its numbers could differ from the page’s.',
    'A line under the email’s name says what is left out, in the page’s own words. With nothing left out, the email reads as it did.',
    'If the list cannot be read, the email leaves nothing out and says the list was not read.',
  ],
}

export default note
