import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.2260',
  date: '2026-08-25',
  title: 'Cost estimates learn: actuals at sign-off',
  kind: 'feature',
  highlights: [
    'Costed tasks in the sign-off queue grow a one-tap "Took about" row — record what a task really took while reviewing it; leaving it untouched records nothing.',
    'Completed estimates wear a truth tag beside the gold chip — "was $200 · ×2" in red when over, green when under — and actuals can be added or fixed any time from the cost modal.',
    'Once 5 tasks have actuals, new estimates get a gentle hint ("estimates have really run ×1.6") and Review shows a one-line calibration strip.',
  ],
}

export default note
