import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.2557',
  date: '2026-08-31',
  title: 'Late chips on the job week view too',
  kind: 'feature',
  highlights: [
    'Opening a job\'s week on the Schedule now shows the same ◔ Late chips as the People board.',
    'Lateness is always measured against the person\'s earliest scheduled start across ALL their jobs that day — the same number everywhere, so a chip here never disagrees with the People board.',
  ],
}

export default note
