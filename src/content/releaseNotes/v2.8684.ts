import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.8684',
  date: '2026-11-27',
  title: 'A job’s Activity reads again after a developer clears test notice lines',
  kind: 'fix',
  highlights: [
    'A developer’s Clear in a test job’s Lien window took the lines off the job. The job window open behind it still showed them.',
    'Now the job window’s Activity reads again as soon as the lines are cleared, and the same after a test notice record is deleted.',
    'Only a developer has these two presses, on test jobs. Nothing changes for the office or the crews.',
  ],
}

export default note
