import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.6145',
  date: '2026-10-30',
  title: 'A new task’s schedule drawn on a small calendar (punch list #217)',
  kind: 'feature',
  highlights: [
    'The New task window draws this week and the next three under the weekday buttons. Every day the task lands is filled, the start and the end are marked, and today is ringed.',
    'A start that is not one of the picked days is ringed amber, with the first day that lands named under the calendar.',
    'For a task that repeats days after it is done, the days the chain would land on are dashed. For a one-off with a due day, a bar runs from its day to the due day.',
    'The green sentence stays under the calendar as its caption. The task’s Edit window draws the same.',
  ],
}

export default note
