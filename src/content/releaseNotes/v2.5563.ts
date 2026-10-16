import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.5563',
  date: '2026-10-15',
  title: 'Prospects: every other page keeps to the customer deck, and a callback opens on its own tab',
  kind: 'fix',
  roles: ['dev', 'master_technician', 'assistant', 'controller', 'estimator'],
  highlights: [
    'Quickfill’s Prospects counts and its Can’t reach list read the customer deck only, as they always meant. Subs and jobs to GC are counted on their own tabs.',
    'A callback opened from the Calendar opens the prospect on its own tab, so a sub’s card offers Add to the bench ✓ and an owner’s offers Asked us ✓.',
    'Add customer’s Started as a prospect? search no longer offers subs, since a sub lands on the bench. The 30-day table on Activity follows the tab you are on.',
    'The customer deck’s email templates show on the Customers tab only. The words for a sub’s or an owner’s email are the owner’s to write.',
  ],
}

export default note
