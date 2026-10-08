import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.4933',
  date: '2026-10-08',
  title: 'GC mode: the money on our GC jobs, for a dev',
  kind: 'feature',
  roles: ['dev'],
  highlights: [
    'GC projects has a Money view. It shows every GC job that is ours on one screen: paid in, paid out, who owes us and where we stand.',
    'It also shows bill day across the jobs, the next six weeks and what each job makes us.',
    'A part that waits on work still being built says so in one line and shows no number.',
    'Only a dev sees it while GC mode is built. Later the owner and the controller will see it too.',
  ],
}

export default note
