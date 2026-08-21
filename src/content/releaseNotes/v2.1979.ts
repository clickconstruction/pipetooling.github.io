import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.1979',
  date: '2026-08-21',
  title: 'Roadmap Timeline — the roadmap as a Gantt chart',
  kind: 'feature',
  highlights: [
    'A third roadmap view next to Map and Plan: stages cascade as Gantt bars grouped by dependency wave — bar width is remaining work, green fills as tasks complete, milestone stages show as ◆ diamonds, and the amber line marks the work front.',
    'A pace slider ("at N tasks/week") projects approximate dates onto each wave and the 🎯 goal from live remaining-task counts — a what-if that can never go stale.',
    'Tap a row to unfold its numbered tasks; tap a task to open its card. On phones the stage rail shrinks to badges and the chart scrolls sideways.',
  ],
}

export default note
