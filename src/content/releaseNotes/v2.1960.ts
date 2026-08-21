import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.1960',
  date: '2026-08-20',
  title: 'Filtered Billed list wears an orange banner',
  kind: 'fix',
  highlights: [
    'When the Billed Awaiting Payment list is narrowed (90+, 30–90, or no-bill-line), the "Showing only … · Show all" notice is now a centered orange bar across the page — no more mistaking a filtered list for the whole section.',
    'The money-opportunity buttons (Capable list, Show 90+, Accounts Receivable, Show them, and the Waiting-on-customers card) now clear the search bar first, so the list they open is never narrowed by a leftover search.',
  ],
}

export default note
