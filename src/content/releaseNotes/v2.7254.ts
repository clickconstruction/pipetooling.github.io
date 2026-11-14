import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.7254',
  date: '2026-11-14',
  title: 'Lien desk, By date: a band for each month, a quiet line for each GC, and Later as a short list',
  kind: 'feature',
  highlights: [
    'On By date every month is a coloured band. Overdue is red, This month amber, Next month blue and Later grey. The band shows its date, its job count and its money.',
    'A GC’s name is one small line above its jobs, with its counts in its words. It has no row of flags of its own. Press Record what they said on the line to record the GC’s pay date for all of its jobs.',
    'Later starts folded. Opened, it is a list with one line a job: how long ago it was billed, the last day to file the lien and the money. The oldest bill is first.',
    'No hours is a small chip beside the job’s name. The dates under each row are small again and stay inside their row.',
  ],
}

export default note
