import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.6688',
  date: '2026-11-08',
  title: 'The Your week card’s test keeps up with the calendar',
  kind: 'infra',
  roles: ['dev'],
  highlights: [
    'The render test for the Dashboard’s Your week card dated its finished jobs to the week it was written in, so it failed on every pull request once that pay week ended. It now dates them from today.',
    'Nothing changes on the Dashboard.',
  ],
}

export default note
