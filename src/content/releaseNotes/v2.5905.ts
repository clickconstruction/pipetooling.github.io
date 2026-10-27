import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.5905',
  date: '2026-10-26',
  title: 'Job Mode: the day’s press moves to the thumb',
  kind: 'feature',
  roles: ['dev', 'master_technician', 'assistant', 'controller', 'estimator', 'primary', 'superintendent', 'subcontractor', 'helpers'],
  highlights: [
    'On a phone the Job Mode card’s big buttons now sit in a bar pinned above the tab bar: Leave report on the left and the day’s press on the right, Clock In, On my way, I’m here or Wrap Up Day, in reach whatever the day’s list holds.',
    'Over them, three smaller buttons: Turnaway, % done and Clock out. % done opens the same stepper as My Schedule’s Update % done, on the job you are clocked into, for subs, helpers and superintendents.',
    'The card scrolls above the bar, and nothing hides under it. Write up a change, Hand the phone and Message the customer stay on the card as full-size presses. The bar slides away with the tab bar while you type.',
    'The Job Report button at the top of Job Mode, which opened nothing there, is gone on a phone; Tally stays. On a computer or a tablet the card is unchanged.',
  ],
}

export default note
