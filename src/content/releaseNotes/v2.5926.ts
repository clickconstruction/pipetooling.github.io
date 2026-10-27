import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.5926',
  date: '2026-10-26',
  title: 'Money in: the week line is computed',
  kind: 'infra',
  roles: ['dev'],
  highlights: [
    'The rules behind the coming Money in bar (punch list #191): what landed this week, what is still on its way with a day on each chip, and what last week expected that never came.',
    'One chip per job on the expected side, surest kind first: at the bank, in the drawer, they say it\'s sent, their word, then the pace guess.',
    'A check the bank already holds drops its drawer twin, and the Stripe payout is drawn on the day it lands but never summed.',
    'Nothing shows yet — the reads and the bar itself follow in the next two updates.',
  ],
}

export default note
