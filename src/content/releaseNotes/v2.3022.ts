import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.3022',
  date: '2026-09-07',
  title: 'Safety net under Bank payments badges',
  kind: 'fix',
  highlights: [
    'The nickname and colour each bank-transaction kind wears on Jobs → Bank payments now have 8 tests pinning how they are validated, cached, shared across the org and kept readable; no behaviour change.',
  ],
}

export default note
