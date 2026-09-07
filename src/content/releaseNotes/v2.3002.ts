import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.3002',
  date: '2026-09-07',
  title: 'Safety net under the Jobs board loader',
  kind: 'fix',
  highlights: [
    'The loader that fills the Jobs board, Job Summary, Dispatch Mode and Accounts Receivable now has 18 tests pinning which jobs each view asks for and how a partial failure degrades; no behaviour change.',
  ],
}

export default note
