import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.5104',
  date: '2026-10-09',
  title: 'GC mode: waits, places, parts and a new baseline on the schedule',
  kind: 'feature',
  roles: ['dev'],
  highlights: [
    'A dev can put what the work waits on on a GC project’s schedule: a delivery, the customer’s decision, a permit or the utility. Each holds the work that needs it until it is in.',
    'Each bar can keep the place its work is, so the chart flags a day with too many trades in one place.',
    'A trade’s line splits into parts with their own dates, and becomes one bar again.',
    'After a signed change order adds days, a new baseline takes the plan as it stands. The old ones are kept.',
  ],
}

export default note
