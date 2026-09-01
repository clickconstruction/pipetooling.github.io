import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.2580',
  date: '2026-09-01',
  title: 'Division 22 groundwork — the spec-section ledger',
  kind: 'infra',
  highlights: [
    'Behind the scenes: a new org-wide ledger maps fixture names to Division 22 spec sections (WC-… → 22 42 13, WASTE footage → 22 13 16, and so on).',
    'Seeded with the standard MasterFormat sections and starter rules for the house naming — gas and a few ambiguous prefixes wait on a spec-book decision.',
    'Nothing changes on screen yet: the next release uses this to add section codes to the parts-house fixture list.',
  ],
}

export default note
