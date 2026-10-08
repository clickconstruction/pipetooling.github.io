import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.4962',
  date: '2026-10-08',
  title: 'GC mode: the schedule’s day math in one place',
  kind: 'infra',
  roles: ['dev'],
  highlights: [
    'The GC mode schedule now counts its days in one place: the calendar, what waits on what, the spare days and what a move pushes.',
    'The spare days measure a bar with the chart’s own calendar, so the bar and its spare days can never count a stretch two ways. Nothing on screen changes.',
  ],
}

export default note
