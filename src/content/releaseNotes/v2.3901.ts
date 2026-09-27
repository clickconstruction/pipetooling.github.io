import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.3901',
  date: '2026-09-27',
  title: 'Put a GC on notice: the jobs re-read after you mark one right',
  kind: 'fix',
  highlights: [
    'In Put a GC on notice, changing a job’s status or % done from a chip now updates the list when you close the job: the job moves to its new stage, its chip clears and the counts follow. Before, the list kept the old record until the window was reopened.',
    'A line that is only partly done says how much of it is — “$720 done · not billed” — instead of reading as fully done.',
    'Each line’s state sits under its name, so a line’s name is no longer cut to three letters.',
    'On a phone, a job’s open amount, its bid and its line prices stay on screen; a long job name was pushing them off the right edge.',
  ],
}

export default note
