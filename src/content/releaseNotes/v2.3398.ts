import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.3398',
  date: '2026-09-14',
  title: 'Jobs on a map: scroll back in time',
  kind: 'feature',
  highlights: [
    'Tap “As of” beside the map’s title and a slider appears. Drag it back and every pin wears the status the job had on that day — blue where it was still working, orange where the bill had gone out — and jobs that did not exist yet disappear. Press Play and the map walks forward a day at a time to today.',
    'The rail follows the day: the dollars to collect are that day’s open bills minus the payments in by then, and Ask for money lists what was waiting on that day.',
    'A line under the map says what happened since — jobs started, billed, paid, sent to collections. History starts Feb 22, 2026, the day the Pipeline began recording moves; the slider stops there and says so.',
  ],
}

export default note
