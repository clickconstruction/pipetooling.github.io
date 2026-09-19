import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.3618',
  date: '2026-09-19',
  title: 'Sub Labor sheets: a sub on the bench is no longer offered for a new sheet',
  kind: 'fix',
  highlights: [
    'The crew lists on the Sub Labor sheet form (External subs, Subs with an account) leave out anyone the office set On the bench on People → Subs. Reactivate them there and they are back in the list.',
    'A benched sub already named on an existing sheet stays on it; only the pick lists change.',
  ],
}

export default note
