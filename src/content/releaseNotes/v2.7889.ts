import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.7889',
  date: '2026-11-18',
  title: 'Needs you: a stage that reads 100% and is not billed',
  kind: 'feature',
  highlights: [
    'When the crew puts a stage at 100% and no bill carries it, the office’s Needs you says so. The line names the stage, its job and its dollars.',
    'Open the job opens that job’s window, where the Bill tab is. The line offers the bill. It never makes or sends one.',
    'It reads Working jobs with two or more priced lines. A job on one line is left to Ready to Bill, as before.',
  ],
}

export default note
