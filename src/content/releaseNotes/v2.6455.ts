import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.6455',
  date: '2026-11-03',
  title: 'The SQL beds run in two groups instead of five, so a run takes two build machines and about 9 minutes of build time',
  kind: 'infra',
  roles: ['dev'],
  highlights: [
    'Each group of database test beds downloads the database image and builds its own migrated copy before its beds run. With five groups, a run did that five times.',
    'A run is now two groups of up to 40 beds. Side by side, it used 8.7 minutes of build time instead of 15.5, and 2 of the 20 build machines we get at once instead of 5.',
    'The slowest group took about 5 minutes instead of 4, so when machines are free a pull request waits about a minute longer for its beds.',
  ],
}

export default note
