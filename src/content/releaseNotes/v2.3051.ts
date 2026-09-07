import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.3051',
  date: '2026-09-07',
  title: 'Quickfill: Unassigned field time is a count card that opens the Team board',
  kind: 'feature',
  highlights: [
    'The station now shows how many person-days in the window had paid field time with no job, one line per week, instead of listing every day.',
    'Each week line has Open on Team board →, which lands on that week of Jobs → Team with Only exceptions ticked, so the fix (Link to the dispatch block, Pick job, Split day) is one tap away.',
    'When the window is clear the card reads All on a job. The Match sessions to jobs block still appears under the card when recent sessions have no job.',
  ],
}

export default note
