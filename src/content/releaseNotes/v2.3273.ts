import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.3273',
  date: '2026-09-11',
  title: 'Job Summary shows where the discounts went',
  kind: 'feature',
  highlights: [
    'On Job Summary, the "− $X discounted on N jobs" chip now opens: how much was given away as a share of the revenue in view, then the same by reason (Negotiated, Referral, Repeat customer, Goodwill, Price match) and by who gave it.',
    'The reasons come from the chips on the discount rows; the givers come from the activity trail. Money view only, and it follows the window you have set.',
  ],
}

export default note
