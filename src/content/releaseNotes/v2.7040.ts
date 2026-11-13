import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.7040',
  date: '2026-11-12',
  title: 'Pay calendar: the job window and Call mode read the due day too',
  kind: 'feature',
  highlights: [
    'For a payer on a pay calendar, the job window’s bills list says the day a bill is due, as the Pipeline row does.',
    'Call mode judges such a payer against its calendar. Its speed line says how long after their pay day the money usually lands.',
    'The same bill now reads the same day on the board, in its job window and on a call.',
  ],
}

export default note
