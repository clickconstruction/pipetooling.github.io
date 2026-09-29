import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.4181',
  date: '2026-09-29',
  title: 'What the team sees: the Check returned notice renders live',
  kind: 'feature',
  highlights: [
    'Settings → What the team sees opens the Check returned notice on a sample returned draw — whose check, how much, which job, the bank\'s reason, and the one step that takes it off the job — as the office receives it.',
    'The notice is unchanged; it already ran on a shared kernel, so nothing moved on the server.',
    'Twenty-four of the twenty-five team emails render live; the roster audit is the last.',
  ],
}

export default note
