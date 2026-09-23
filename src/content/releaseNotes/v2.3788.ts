import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.3788',
  date: '2026-09-23',
  title: 'Pipeline: find the Working jobs with no date',
  kind: 'feature',
  highlights: [
    'The Working header now carries four pills — All, Not scheduled, This week, Later — counted from the same two-week strip every row draws. Pick one and the Working rows narrow to it; Not scheduled is the fourteen you would otherwise scroll forty rows to find.',
    'Not scheduled means nothing booked from today on and the job under 100 %. Finished jobs with nothing booked are not gaps: a line under the list says how many were left out, because their next step is Ready to Bill, not a booking.',
    'Beside the pills, ⇅ Next first reorders every section by the next booked visit: today’s at the top, then later this week, then the unbooked rows with the longest-untouched first, finished rows last. Press it again for the usual job-number order. The pick is remembered on this device, and the ⋯ menu’s Sort group offers it too.',
  ],
}

export default note
