import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.4713',
  date: '2026-10-07',
  title: 'Lien desk: offer a discount if they pay before the lien',
  kind: 'feature',
  highlights: [
    'When the leader approves a § 53.056 notice, a new box offers a discount on each enclosed bill if it is paid in full by a day. The default is 10% and 14 days after the notice mails, never later than a week before the affidavit must be filed.',
    'The owner’s pay page says it in one boxed sentence under its title, every Stripe bill’s row shows both amounts, and the closing line sums the lower ones. The notice form itself never changes, and the claim stays the full amount.',
    'The Do now row and its step card say Approved with a 10% offer, by Nov 15. On an approved notice the leader can still change or remove the offer until the run goes out.',
    'The money side, where the scanned code shows the lower amount and the bill is written down once paid, ships in the next release.',
  ],
}

export default note
