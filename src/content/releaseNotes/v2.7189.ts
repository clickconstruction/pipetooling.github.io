import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.7189',
  date: '2026-11-13',
  title: 'Tasks: two lines that read wrongly',
  kind: 'fix',
  highlights: [
    'On the roadmap, Add task no longer writes two full stops when a stage\'s name ends in one. It reads "It joins the stage North fence." once.',
    'Edit task says "Saving reshapes the days still to come" only on a task that repeats. A one-time task no longer shows it.',
  ],
}

export default note
