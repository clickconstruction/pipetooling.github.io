import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.3736',
  date: '2026-09-22',
  title: 'Day book: past days say what was still waiting on deposits and contracts',
  kind: 'feature',
  highlights: [
    'When a dev or controller opens the Dashboard, the app records once a day what the Needs You card counted as still waiting — deposits to match, jobs without a contract — so the Day book can say it for past days: Applied 4 deposits · 1 left to match, Sent 2 contracts · 103 jobs still without one.',
    'The Month view can now turn an empty run on the Deposits and Contracts rows amber, from the day the recording started. A day nobody opened the Dashboard has no figure and stays plain.',
  ],
}

export default note
