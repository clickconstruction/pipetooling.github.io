import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.5113',
  date: '2026-10-09',
  title: 'GC projects: the database is ready for a customer to pay a certified bill by card',
  kind: 'infra',
  roles: ['dev'],
  highlights: [
    'Behind the scenes, a GC customer’s certified bill can now turn into a card bill with a 3% credit card fee. Only their portal can do it, and only on a bill with no payment on it. The portal’s button comes next.',
    'The fee rides on the bill as its own line, so the job is not marked paid while a bill is still open. Every GC money figure still reads what the architect certified.',
    'The money team can take a card bill back to a check bill while nothing is paid on it.',
    'Edit Job keeps a GC card fee in the job’s total, the way it keeps a returned check fee.',
  ],
}

export default note
