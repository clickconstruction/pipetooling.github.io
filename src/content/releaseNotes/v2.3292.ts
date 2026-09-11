import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.3292',
  date: '2026-09-11',
  title: 'Bids: one cost total everywhere, and the Labor tab says why it could not save',
  kind: 'fix',
  highlights: [
    'The Pricing Workbench, the Pricing print and CSV, the Labor page print and the approval PDF now read the same cost breakdown, so the total is one number in every place. The documents gain an "Other direct" line (equipment, permits, subs, waste, other) and count team labor clocked on the bid, as the Workbench always did.',
    'The Labor tab’s autosave no longer sticks on "Saving…" when a box holds something it cannot save. It now reads "Not saved — the labor rate must be a number, 0 or more" (or whichever box is wrong) until you fix it.',
    'Per-100-ft and task rows now price the same on the Pricing grid’s per-row labor as on the Labor tab.',
  ],
}

export default note
