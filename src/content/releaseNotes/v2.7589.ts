import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.7589',
  date: '2026-11-17',
  title: 'Tasks: an assistant can set, move or take off a task’s place',
  kind: 'infra',
  highlights: [
    'A developer’s assistant can now set the place of a task already given, move it, or take it off, as Edit does on the Checklist.',
    'The place can be said as a point on the map, a street address, a job, or the name of a place another task already has.',
    'It shows the point with a map link before anything is saved, and how far the place would move.',
    'Giving a task through the assistant takes a place the same four ways.',
  ],
}

export default note
