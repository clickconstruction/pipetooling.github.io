import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.5127',
  date: '2026-10-09',
  title: 'GC mode: close out a trade and close the job, for a dev',
  kind: 'feature',
  roles: ['dev'],
  highlights: [
    'A job we are building has a Closeout window. It walks each trade through its last steps and pays back the retainage we hold.',
    'Accept the work waits on the trade’s punch list. A final pay application that came by email is recorded there. Approve the release opens 10 days after the customer pays us ours.',
    'Close the job waits until every trade is closed out. A closed job moves to its own place on the board.',
    'In the Draws window, They signed it records a change a trade signed on paper or by email.',
  ],
}

export default note
