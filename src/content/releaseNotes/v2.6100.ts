import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.6100',
  date: '2026-10-29',
  title: 'Offline in the field, part 3: a job note and a field report wait on the phone too',
  kind: 'feature',
  highlights: [
    'A job note from Job Mode and a field report from Leave Report are kept on the phone when they cannot reach the office, like a clock press. They go out in the order you pressed them when the signal is back, and the line at the top counts them with the clock presses.',
    'A note or a report that waited is filed at the moment you wrote it, so the job’s thread reads in the order things happened. A report’s notifications, its moved lines and the job’s percent follow once it lands.',
    'While a note waits it stays on the thread on your phone. A report with photos still needs a signal, so it stays open on its form with Retry. Turnaway reports need one too, since they also raise a dispatch alert.',
  ],
}

export default note
