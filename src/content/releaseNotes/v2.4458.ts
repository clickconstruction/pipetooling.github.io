import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.4458',
  date: '2026-10-02',
  title: 'Sub portal: a stage, a progress report and a signature read their own day',
  kind: 'fix',
  highlights: [
    'On a sub’s portal, a job card read the next day for anything done after 7 pm Central. That hit the day the stage moved, the day of the last progress report and the day the order was signed.',
    'All three now read their day on the company’s calendar, as the payment lines already did.',
  ],
}

export default note
