import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.7412',
  date: '2026-11-15',
  title: 'Tagged job notes: tag and answer from the job window',
  kind: 'feature',
  highlights: [
    'The note box in the job window, in Job Mode and in Quickfill now has the @ button and the list of names.',
    'A note you type there answers any tag that waits on you on that job, the same as a note on the Pipeline row.',
    'A note typed with no signal is kept on the phone. Its tag goes with it when the note is sent.',
    'A stamp such as Arrived, and a % complete line, still answer nothing.',
  ],
}

export default note
