import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.3523',
  date: '2026-09-16',
  title: 'Capacity takes recorded time off into account',
  kind: 'feature',
  highlights: [
    'Job Summary → Capacity no longer counts a field person as available on a day they are recorded off — the available hours come down, utilization recomputes, and a new Time off tile says how much came off.',
    'On the chart, a dashed cap on a week’s bar shows the hours that were taken off.',
    'Company holidays still have no record in the app, so a holiday week reads low until they do.',
  ],
}

export default note
