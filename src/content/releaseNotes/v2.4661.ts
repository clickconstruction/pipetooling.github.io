import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.4661',
  date: '2026-10-06',
  title: 'Release of Lien: Cancel request lets you change the waiver',
  kind: 'fix',
  roles: ['dev', 'master_technician', 'assistant', 'controller'],
  highlights: [
    'When a lien waiver waits at the leader’s desk, Cancel request now makes it a draft again, so you can change it and ask again.',
    'A waiver printed for a paper signature first stays locked when you cancel. Its steps say to void it and make a new one.',
  ],
}

export default note
