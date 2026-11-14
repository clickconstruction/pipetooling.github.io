import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.7260',
  date: '2026-11-14',
  title: 'Setting a job to 100% can move it to Ready to Bill in the same press',
  kind: 'feature',
  highlights: [
    'In the % done window, a Working job at 100% shows one more line: Also move to Ready to Bill. It starts unticked.',
    'Tick it, and Save reads Save 100% and move to Ready to Bill. One press saves the percent and moves the job. The second window with two checkboxes no longer follows.',
    'If the move is refused, the percent is still saved. The window says why and offers the move again.',
    'It works from a schedule card and from the Bridge, where the window still moves on to the next job.',
  ],
}

export default note
