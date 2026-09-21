import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.3680',
  date: '2026-09-21',
  title: 'Lien desk: a closed window nobody has noted no longer ages off the desk',
  kind: 'fix',
  highlights: [
    'A month whose notice window closed with nothing recorded used to fall off the Lien desk a week after its deadline, taking the Dashboard line with it. It now stays until someone notes it as missed or skips it.',
    'Once noted or skipped, the month keeps its week on the desk and then drops; its record stays under Earlier months on the job.',
    'Months whose window closed before the desk went live on Sep 14 are not swept in.',
  ],
}

export default note
