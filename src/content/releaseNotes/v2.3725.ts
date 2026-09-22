import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.3725',
  date: '2026-09-22',
  title: 'Payments view: bands by week paid or by person',
  kind: 'feature',
  highlights: [
    'Beside the window chips on the Payroll tab’s Payments view: Flat, By week paid, By person. By week paid opens a band for every company week the money went out, Sunday to Saturday, with the week’s count, total and how many people; By person opens one band per person with their total and the weeks they were paid in.',
    'Inside a band the rows keep whatever sort you chose, and the layout is remembered on your device. The total under the table is still what is showing.',
  ],
}

export default note
