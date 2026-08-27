import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.2393',
  date: '2026-08-27',
  title: 'Pricing Workbench: Apply margin per row, calmer breakdown, prices that read as money',
  kind: 'feature',
  highlights: [
    'The New pricing view now has the Old grid\'s Apply margin column — your recent margin as a one-tap chip plus the "…" picker, right on every costed row.',
    'The Margin breakdown window only opens from the row\'s ⓘ button now — clicking around the row while you type no longer pops it up.',
    'Sale price/unit reads as money ($1,410.00), and clicking into a price always selects the whole number — typing replaces it instead of tacking digits onto what was there.',
  ],
}

export default note
