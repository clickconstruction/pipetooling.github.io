import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.2246',
  date: '2026-08-24',
  title: 'Sub Labor amounts: smaller cents',
  kind: 'feature',
  highlights: [
    'Every dollar amount on Jobs → Sub Labor now shows its cents in a smaller font, so $40,000.00 and $4,200.00 are easy to tell apart at a glance.',
    'Copy and paste is unchanged — selecting an amount still gives you the full figure with cents.',
  ],
}

export default note
