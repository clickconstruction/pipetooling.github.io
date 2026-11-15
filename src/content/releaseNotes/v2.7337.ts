import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.7337',
  date: '2026-11-15',
  title: 'The run’s checklist holds a notice whose job was paid after it printed',
  kind: 'fix',
  highlights: [
    'A row in the run whose job owes $0 today now reads Held, with the reason and what the paper says, like “Nothing to claim: the job owes $0 now. The paper says $1,380.” Its envelope card already said so; the checklist counted it as live.',
    'Mark N signed and Record N mailings leave a held row out, and the foot counts it apart, like “2 to sign · 5 held”. One press can no longer write a pen signature onto a notice that will never go out.',
    'On the held row itself, Signed reads “nothing to sign” and the Mailed boxes are closed. The rows that are still owed work as before.',
  ],
}

export default note
