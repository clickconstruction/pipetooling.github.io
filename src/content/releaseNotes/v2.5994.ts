import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.5994',
  date: '2026-10-27',
  title: 'An email to someone nobody has named reads as an address on Went out, not a number',
  kind: 'fix',
  roles: ['assistant', 'controller', 'estimator', 'master_technician', 'dev'],
  highlights: [
    'On Messages, a row under Went out, Waiting on them or the search for a person nobody has named now says how that line went. An email reads "An address nobody has named". A text or a call reads "A number nobody has named". Every such row read as a number before, even an email to an address with no phone on it.',
    'Wendi found it on 2026-10-27, testing the page with an email to herself: the row under Went out read "A number nobody has named · don\'t believe the hype".',
  ],
}

export default note
