import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.4875',
  date: '2026-10-07',
  title: 'Schedule Dispatch: not coming in and no-call-no-show live in one place',
  kind: 'infra',
  roles: ['dev'],
  highlights: [
    'Behind the scenes, the code behind Not coming in, No call no show and their undo moved to its own file.',
    'Nothing changes on screen. Each one asks, writes, warns and reloads the week as it did.',
    'New tests cover each flow and what a refusal leaves alone.',
  ],
}

export default note
