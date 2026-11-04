import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.6469',
  date: '2026-11-03',
  title: 'A development’s Photos look tells an estimator the crews’ photos are for the office',
  kind: 'fix',
  highlights: [
    'On a development’s page, an estimator’s Photos look now says the crews’ photos on the jobs are for the office. It used to read Nothing filed yet on a site full of photos.',
    'The look keeps the pictures sent by text or email on the site’s jobs and bids, and drops the source chips that could only come up empty.',
  ],
  roles: ['dev', 'estimator'],
}

export default note
