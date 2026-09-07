import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.3048',
  date: '2026-09-07',
  title: 'Safety net under the card-charge split modal',
  kind: 'fix',
  highlights: [
    'Opening a card charge’s job-split modal from a job now has 3 tests pinning what is loaded — the charge, its splits, who was attributed, the job labels and card nicknames — and how a missing piece degrades; no behaviour change.',
  ],
}

export default note
