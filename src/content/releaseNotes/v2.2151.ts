import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.2151',
  date: '2026-08-23',
  title: 'GC Review knows the GC\'s portal',
  kind: 'feature',
  highlights: [
    'Each GC row in GC Review now carries the same globe as everywhere else — open it to see or share their portal address, preview as the customer, or set up a GC-bills-only view.',
    'The Share menu gains Copy portal link (it tells you whether that link is the GC-bills-only view or the full account).',
    'Draft Message adds a small "Your account, any time" card under the statement table pointing at their portal, where they can see it live and pay online — on by default when their portal is active, with a checkbox to leave it out. Copy gets the same line; scheduled sends include it automatically while the portal is active.',
  ],
}

export default note
