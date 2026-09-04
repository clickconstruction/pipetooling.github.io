import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.2762',
  date: '2026-09-04',
  title: 'People → Users: one row shape, and Add says what it adds',
  kind: 'feature',
  highlights: [
    'Every person on Users now reads the same way: the imitate icon where it always was, an attention dot, the name (which opens their desk), a "login" or "no login" chip, contact, a few labeled chips (sessions waiting, docs unsent or expiring, no roster row, portal on), and one ⋯ menu for the rest.',
    'The "External Subcontractors" and "External Helpers" groups are gone. A sub without a login is simply a Subcontractors row with a "no login" chip; long lists fold behind "+ N more without a login".',
    'Filters above the list: Everyone, No login, Needs attention, Field, Office. Search stays put while you scroll. Team leads, Accounts (dev), Archived and Add to roster sit in one toolbar.',
    'Add is now "Add to roster": it says a roster row needs no login, offers the kind as pills, and can invite them to sign in and open their desk right after saving.',
  ],
}

export default note
