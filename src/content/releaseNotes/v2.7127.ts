import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.7127',
  date: '2026-11-13',
  title: 'Pay calendar: Money waiting and Accounts Receivable read the due day',
  kind: 'feature',
  highlights: [
    'Money waiting no longer calls a pay calendar customer slow for a bill that is not yet due.',
    'Their row leads with how far past expected their worst bill is. Each bill names its due day.',
    'The Dashboard’s Accounts Receivable reads the same way, and so do its call opener and call summary.',
    'A bill 30 days past its expected day has missed a whole pay run, and reads red.',
  ],
}

export default note
