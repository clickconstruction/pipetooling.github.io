import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.5152',
  date: '2026-10-10',
  title: 'GC mode: a trade partner sees its job in its portal',
  kind: 'feature',
  roles: ['dev'],
  highlights: [
    'Once its statement of work is signed, a trade partner’s portal shows its job: each line’s percent done and what we paid through.',
    'It also shows its punch list, the submittals it owes, its draws and its questions while we build, with their answers.',
    'It sees only its own trades on the job, never what the customer pays or who in the office typed something.',
    'For now it reads them. The buttons to answer each come next.',
  ],
}

export default note
