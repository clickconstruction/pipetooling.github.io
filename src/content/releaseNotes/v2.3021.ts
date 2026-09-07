import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.3021',
  date: '2026-09-07',
  title: 'Safety net under the Pipeline numbers',
  kind: 'fix',
  highlights: [
    'The read behind the Pipeline strip, the Dashboard AR card, the Billed pin and the chase queue now has 6 tests pinning exactly which jobs, invoices and payments it asks for and what it hands back; no behaviour change.',
  ],
}

export default note
