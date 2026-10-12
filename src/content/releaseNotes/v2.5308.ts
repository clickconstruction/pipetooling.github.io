import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.5308',
  date: '2026-10-12',
  title: 'Messages: every person you work with on GC projects, and their thread',
  kind: 'feature',
  roles: ['dev', 'master_technician', 'assistant', 'controller', 'estimator'],
  highlights: [
    'GC projects has a Messages view: each customer, trade partner and architect in one list, newest conversation first, with a search over every word.',
    'Press a person to open their thread over the page. It holds the emails the office sent them from the app, and their jobs with a star where new messages land.',
    'Tie a message to a job by dragging the job onto it. A number nobody knows can be named from its thread.',
    'Calls, texts and the emails they send us join the thread in later updates.',
  ],
}

export default note
