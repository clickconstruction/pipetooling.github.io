import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.7280',
  date: '2026-11-14',
  title: 'Lien desk: confirm a month dated from the bill, so the flag turns quiet',
  kind: 'feature',
  highlights: [
    'A job with no clock hours takes its lien month from its bill, and the desk flags that month on every paper. The affidavit pane now asks: Is August the month the work was done? Press Yes, August is right ›, type who said so and when, and press Confirm August.',
    'The check is saved on the job with your name and the day. No date moves and no paper changes. The flag turns quiet on the pane, the job’s Lien window, the printed help sheet and the notice record, and the help sheet’s Work month row reads ✓.',
    'If the work ran in another month, Set the last day of work › opens today’s door, which moves the clocks. Change › on the quiet line changes the note. A last day of work set later puts the question back.',
    'The dev seat’s plan_affidavit_draft reply names the check under month_checked.',
  ],
}

export default note
