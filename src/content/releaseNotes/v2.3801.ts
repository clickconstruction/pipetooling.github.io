import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.3801',
  date: '2026-09-24',
  title: 'Day book: a past Billed line says what was still left to bill',
  kind: 'feature',
  highlights: [
    'When a dev or controller opens the Dashboard, the Ready to Bill stage’s count is recorded for the day alongside the deposits and contracts counts, so a Billed line on a past day can end “13 left to bill” and the Month grid’s Billing row can go amber when bills waited three working days.',
    'Today’s Billed line reads the same recorded figure — the tab has no live count for bills, so the number is as of the last Dashboard look that day.',
    'The count is only recorded once the stage has actually loaded, never as a zero before it has.',
  ],
}

export default note
