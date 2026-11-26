import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.8615',
  date: '2026-11-26',
  title: 'Accounts Receivable: a case a new deposit replaced stays closed, in the database too',
  kind: 'fix',
  highlights: [
    'Reopen under Closed cases undoes a close by hand: settled another way, or not coming. That was the screen’s rule alone.',
    'The database now holds the same rule for a returned check’s case. A case closed because a new deposit replaced it cannot be opened again, and keeps the deposit it names.',
    'Nothing changes on the screen. The two other kinds of case already worked this way.',
  ],
}

export default note
