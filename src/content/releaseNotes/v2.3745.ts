import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.3745',
  date: '2026-09-22',
  title: 'Put a GC on notice: the cover letter is now counsel’s',
  kind: 'feature',
  highlights: [
    'The letter to owners is rewritten to counsel’s wording: one number (the claim on the form), what § 53.081 lets them withhold and what § 53.084 does if they pay the GC anyway, one real deadline — before the next payment to the GC — and three ways to end it, none of them a joint check. The two sentences counsel struck are gone: “pay us directly and deduct it” and “not paying its subcontractors generally”.',
    'One letter per property kind — Commercial, Residential, Homestead — each on its own tab in Step 3, and a tick for a GC that is not answering, which sends the unresponsive letter naming the affidavit date. New fills: the claim amount, a stale-month footnote, the signer and phone, the affidavit month.',
    'The form claims the timely months only. A month whose notice window has closed is not in the claim amount any more; its dollars go in one sentence of the letter, as information. A job whose every window has closed is left out of the run.',
    'The § 53.254(g) homestead statement now prints in the statute’s exact words, including its closing paragraph.',
  ],
}

export default note
