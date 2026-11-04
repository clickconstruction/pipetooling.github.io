import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.6479',
  date: '2026-11-03',
  title: 'The Subs tab counts paid sheets as settled, and opens documents under the sub',
  kind: 'fix',
  roles: ['dev', 'master_technician', 'assistant', 'controller'],
  highlights: [
    'Track record now counts every sheet paid in full as settled. It used to read 0 settled for nearly every sub.',
    'Documents opens right under the sub’s own row instead of below the whole list.',
    'A long sub name that wraps stays lined up on the left.',
    'The yellow warning names the Balance due column and lists the names on a shared sheet as plain words.',
  ],
}

export default note
