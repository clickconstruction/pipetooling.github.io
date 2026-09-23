import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.3747',
  date: '2026-09-23',
  title: 'Lien notices: a job with no clock hours is dated from the day it was created',
  kind: 'fix',
  highlights: [
    'Put a GC on notice and the Lien desk only knew a job by its approved clock hours, so a billed job nobody had clocked in on silently fell out of the run while the Pipeline still showed it open — on RMC- Dudley Mason that was 15 jobs and about $80,000. Those jobs are back: a job with no approved hours gets one month, the month it was created, and its notice window runs from there like any other month.',
    'Every such row says so — dated from the job’s creation · no clock hours — in the GC run, on the Lien desk’s list and month card, on the affidavit pane and on the owner-of-record sitting; the saved draft and the recorded notice keep the note, so the paper trail says where the date came from.',
    'An old job’s creation month can already be closed: it is listed and named as information, never hidden, and the form still claims the timely months only. The nightly owner lookup now covers these jobs too.',
    'One database change, applied after the release; the office sees the new rows the moment it lands.',
  ],
}

export default note
