import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.2117',
  date: '2026-08-23',
  title: 'Cover Letter: Old / New — New bundles the bids in your package',
  kind: 'feature',
  highlights: [
    'The Cover Letter tab has Old / New pills like Pricing. New lists the bids in this package under "In this cover letter" — check the ones that go in, each at its ★ price. Old is today\'s letter, untouched.',
    'Each bid in the letter is Base (adds to the letter total) or Alternate (offered in lieu). The headline is the letter total — sum of the base bids — and that\'s what Apply to Bid Value writes.',
    'The version picker\'s badge ("in letter ✓ · base / alternate" or "not in letter") and the New letter read the same flag, so they can\'t disagree. "Send… →" lands on New.',
    'Each bid in a package now remembers its own ★ price scenario — switching between bids on the Pricing tab no longer loses the other one\'s star.',
  ],
}

export default note
