import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.5962',
  date: '2026-10-26',
  title: 'A crew screen that cannot load says why and offers Retry',
  kind: 'fix',
  highlights: [
    'A crew or phone screen that cannot load now says why, with a Retry button. With no signal, it loads again by itself once the signal is back.',
    'This covers the Job Mode card, Home and its job pipeline, Customers, My requests, My crew, Rate my crew, My vehicle, Job Tally, the Checklist, Training, Crew Day and a job\'s recent activity.',
    'My vehicle and My crew used to vanish when their read failed, which looked like no vehicle and no crew. They now stay on the Dashboard with the reason.',
    'A list that never loaded no longer shows an empty line such as No card transactions to show yet.',
  ],
}

export default note
