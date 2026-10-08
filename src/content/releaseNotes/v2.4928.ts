import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.4928',
  date: '2026-10-08',
  title: 'GC mode: our bills to the customer read back from the database',
  kind: 'infra',
  roles: ['dev'],
  highlights: [
    'The app can now read our pay applications to a GC customer back from where they are kept. That covers their lines, our reminders to pay, interest bills and the customer’s acceptance.',
    'The billing rules read them the same way they read the made-up jobs. Payments and promises come later, so every bill reads unpaid for now.',
    'Nothing on screen changes yet.',
  ],
}

export default note
