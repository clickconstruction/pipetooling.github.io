import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.4822',
  date: '2026-10-07',
  title: 'Moving a payment Stripe holds: the right words, and no Stripe bill left open',
  kind: 'fix',
  highlights: [
    'Move to job… on a payment Stripe holds calls it a check only when it is one. Cash and other payments read as a payment.',
    'When the payment lands on the other job’s Stripe bill, it is recorded the way Mark Paid would record it there. A whole check waits its seven days, any other whole payment closes the Stripe bill at once, and a part payment lowers the pay link.',
    'The grey moved line gives the reason once, without repeating the job it went to.',
    'A check dated more than a week back says Stripe closes the invoice the next morning, not a day that has already passed.',
  ],
}

export default note
