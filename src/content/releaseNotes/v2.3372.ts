import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.3372',
  date: '2026-09-12',
  title: 'The newest % complete wins, whoever set it',
  kind: 'fix',
  highlights: [
    'A % complete typed on the job after the crew’s last report now counts as the current one. Before, any report with a % beat the office’s number no matter how old it was — Mission Hills read "100% spent at 77% done" from a May report while the job said 90%.',
    'Applies everywhere the % is read: the Pipeline’s burning-jobs card, Job Summary’s % column and Burn, the Costs tab’s verdict and chart, and the Quickfill "complete, no bill" list.',
    'On the Costs tab a hand-set % steps the value line on the day it was typed, without a report flag, and the verdict says "(set on the job)".',
  ],
}

export default note
