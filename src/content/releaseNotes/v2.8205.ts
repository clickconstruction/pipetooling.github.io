import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.8205',
  date: '2026-11-21',
  title: 'A place set with no signal waits on the phone',
  kind: 'feature',
  highlights: [
    'Set a place on a job with no signal and it is kept on your phone, with its photos.',
    'The app sends it when the signal is back. A line near the bottom says how many places wait, with Send now.',
    'A place waits seven days. Open the app with signal before then.',
    'Only a new place waits. A change to a saved place still says it did not save.',
  ],
}

export default note
