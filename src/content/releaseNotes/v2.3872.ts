import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.3872',
  date: '2026-09-26',
  title: 'Edit Job: three confirm windows are their own pieces',
  kind: 'fix',
  highlights: [
    'The “Remove payment?” confirm, the Stripe line-descriptions preview and the “Unlink and remove?” confirm for a bank-linked payment were drawn inside the Edit Job form; each is now its own component with a smoke test, and the form only says when to open them and what to do on Confirm.',
    'Nothing on screen changes.',
  ],
}

export default note
