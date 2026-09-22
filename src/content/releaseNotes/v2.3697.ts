import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.3697',
  date: '2026-09-22',
  title: 'Lien desk: click a plain value on the notice and land where it is set',
  kind: 'feature',
  highlights: [
    'The values on the notice that are filled from elsewhere now say where on hover, and a click takes you there — on the field, ringed for a moment: the original contractor opens Edit Job on its GC row, the claimant’s name and address open Settings → Company on that field, the claim amount opens the claim box.',
    'When you come back, the paper re-reads the job and rings the value that changed, so you see the change land where you started.',
    'The date has no door — it is the day the notice is drafted or sent — and says so.',
  ],
}

export default note
