import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.2550',
  date: '2026-08-31',
  title: 'The schedule board shows who came in late — automatically',
  kind: 'feature',
  highlights: [
    'When someone clocks in more than 15 minutes after their first scheduled block, their day cell on the Schedule People view shows an amber "◔ Late 2h 15m" chip. Nobody marks anything — it\'s computed from their actual clock-in.',
    'Hover the chip for the receipt: scheduled start (and job), actual first clock-in, exact minutes late.',
    'Inside the 15-minute grace, or with no clock-in at all, no chip — a missing person is a call-out or NCNS question, not a late one.',
  ],
}

export default note
