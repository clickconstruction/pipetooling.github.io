import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.3038',
  date: '2026-09-07',
  title: 'Safety net under a job’s card charges',
  kind: 'fix',
  highlights: [
    'The card charges listed on a job — Job Summary, the Parts tab and the per-person parts cost — now have 4 tests pinning which charges count, which carry a supply-invoice link, and who each is attributed to; no behaviour change.',
  ],
}

export default note
