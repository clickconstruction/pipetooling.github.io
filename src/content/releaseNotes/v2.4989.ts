import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.4989',
  date: '2026-10-08',
  title: 'Dispatch: one strip at a time',
  kind: 'fix',
  highlights: [
    'Before, following a link to place a job while you were copying jobs linked showed two strips at once: the placing strip and the linked-copy strip. Now the link ends the linked copy and closes the job picker, so only the placing strip shows.',
    'Opening the window to add a block also ends the linked copy now, and the place-job link leaves the address at once.',
    'Switching to the Jobs or Day tab ends the linked copy and the job picker too, so the strip no longer waits on a tab where its blocks cannot be picked.',
  ],
}

export default note
