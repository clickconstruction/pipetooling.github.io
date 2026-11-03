import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.6372',
  date: '2026-11-02',
  title: 'The SQL beds run eight at a time, so one run stops filling the runner line',
  kind: 'infra',
  roles: ['dev'],
  highlights: [
    'A run of the 76 SQL beds, the database tests, took 76 build jobs, and we get 20 at once. Pull requests and the merge queue waited behind them.',
    'A run now takes 5 jobs, each running up to eight beds side by side. It uses about 72 minutes of build time, down from about 213.',
    'All 76 beds passed this way. A bed that fails still blocks the merge, and the run’s summary names it with its last lines.',
    'A bed should no longer fail now and then because its port was already taken on the build machine.',
  ],
}

export default note
