import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.8559',
  date: '2026-11-24',
  title: 'Bills sent: the box of test bills now holds the bills made in Stripe’s test mode',
  kind: 'fix',
  highlights: [
    'A developer who shows ZZ test jobs saw no box of test bills. The page never read a bill made in Stripe’s test mode.',
    'The box now holds every test bill with no send on record: one made in Stripe’s test mode, or one on a ZZ test job.',
    'The yellow box, the No send on record chip and the Not paid tile still hold no test bill, for anyone.',
    'On a phone, the name, the day and the note boxes of Say how it went… now stand a thumb tall.',
  ],
}

export default note
