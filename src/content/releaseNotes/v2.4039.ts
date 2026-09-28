import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.4039',
  date: '2026-09-28',
  title: 'Copies of a bill carry the QR code to the recipient’s statement too',
  kind: 'feature',
  highlights: [
    'The people on a bill’s copy list who have a statement of their own — the customer’s contacts, or the GC on a customer’s job — now get the same "Your account, any time" card as the payer: a QR code beside the short address of their statement, where the copy used to end with a plain link.',
    'A copy to a one-off address still has no statement and no code, and a test-mode bill’s one copy to you carries neither.',
    'The copy no longer says the customer was billed "directly by Stripe" — the bill email comes from us now.',
  ],
}

export default note
