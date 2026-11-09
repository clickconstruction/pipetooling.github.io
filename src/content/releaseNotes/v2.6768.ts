import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.6768',
  date: '2026-11-08',
  title: 'The bill text carries a short Click Plumbing link that never expires',
  kind: 'feature',
  roles: ['dev', 'master_technician', 'assistant', 'controller'],
  highlights: [
    'Text, Copy link and the share row’s email draft under a Stripe bill now carry my.clickplumbing.com/pay/… instead of Stripe’s own 160-character link.',
    'The short link opens the bill’s pay page, which asks Stripe for the current payment link each time, so it keeps working after Stripe’s own link expires 30 days past the due date. A paid bill says Paid.',
    'Collect payment’s Copy payment link carries the same short link. Customer pay page, the office’s own press, still opens Stripe directly.',
  ],
}

export default note
