import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.5336',
  date: '2026-10-12',
  title: 'Pipeline: the job activity window loses the band of space under the address',
  kind: 'fix',
  highlights: [
    'The job activity window on the Pipeline tab drew two rules under the job name and address, with a band of empty space between them. Now there is one.',
    'The Sessions button, "esc to close" and the close button sit on the title line instead of floating in the middle of that band.',
    'The thread view opened full screen, and the job calendar window, keep one rule under the title too.',
  ],
}

export default note
