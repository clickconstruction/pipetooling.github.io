import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.6853',
  date: '2026-11-10',
  title: 'Labels: pick Paper sheet or Brother tape first, with the setup steps and a test strip',
  kind: 'feature',
  highlights: [
    'The Labels window now asks first what the labels print on: Paper sheet or Brother tape. Tape used to be a small chip in the corner.',
    'The first time a computer picks Brother tape, the window lists the three steps: the cable, the driver, and the paper size in the print window.',
    'Print 1 test strip prints the first ticked box alone, so a wrong paper size costs one strip and not a whole run.',
    'None and Every box sit beside the box chips. A computer that printed tape opens on tape the next time.',
  ],
}

export default note
