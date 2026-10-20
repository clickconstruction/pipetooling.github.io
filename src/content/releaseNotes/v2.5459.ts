import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.5459',
  date: '2026-10-13',
  title: 'Messages: where a sub is on each of their sheets, read from the work order and the sheet, behind the scenes',
  kind: 'infra',
  roles: ['dev'],
  highlights: [
    'A sub’s steps on a sheet are read from what the app keeps: the work order, the two days on the sheet and its pay.',
    'A sheet is paid only once money went to the sub and covers its lines.',
    'The app can now find a sub’s texts about a sheet’s job and their last word on it.',
    'Nothing shows them yet. The sub sheet’s strip comes with the screens.',
  ],
}

export default note
