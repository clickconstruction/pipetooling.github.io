import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.4863',
  date: '2026-10-07',
  title: 'Schedule Dispatch: the week’s data loads from one place',
  kind: 'infra',
  roles: ['dev'],
  highlights: [
    'Behind the scenes, the code that loads a Schedule Dispatch week moved to its own file. It covers the jobs, the blocks, the people, time off, late clock-ins, the office schedule and swim lanes.',
    'Nothing changes on screen. The board loads, reloads and warns exactly as it did.',
    'New tests cover that load. They found one extra time-off read on a week where someone on the roster is archived. That fix comes separately.',
  ],
}

export default note
