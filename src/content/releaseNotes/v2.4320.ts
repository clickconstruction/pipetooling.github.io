import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.4320',
  date: '2026-10-01',
  title: 'Returned checks: the office hears about every one, on a job or not',
  kind: 'feature',
  highlights: [
    'Every check the bank sends back now emails and pings the Payment made list once, even when no job carries it. The email says where the check is now and who owes the money again.',
    'A check Mercury could not take in, with a payment recorded by hand for the same amount, is caught too when it is not deposited again within five days.',
    'A check that comes back before it posts, for a reason like Insufficient funds, now counts as returned.',
    'A check the bank returned can no longer be unticked as returned by mistake.',
  ],
}

export default note
