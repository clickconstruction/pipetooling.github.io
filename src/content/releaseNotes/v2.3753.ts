import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.3753',
  date: '2026-09-23',
  title: 'Lien desk: the § 53.057 retainage notice, the contract-ended clock, and the signer’s own phone',
  kind: 'feature',
  highlights: [
    'The Lien desk gains a third tab, Retainage: the Texas notice of claim for unpaid retainage (§ 53.057), one per job, due 30 days after our contract on the job is complete, terminated or abandoned. Same piles and approvals as the monthly notices; approved ones go out in the same run, one envelope per name and address, and are recorded on the job.',
    'Edit Job gains a row, Our contract on this job, for jobs with a GC: the day our contract ended and how (suggested from the last approved clock day, never guessed), the retainage the GC holds back, and whether a payment bond is on the project. Until the day is typed the job sits in Clock not started — type it the day the work is done, not when the GC declares it.',
    'Once the retainage is on the job, every § 53.056 notice names it inside the claim (Of which, unpaid retainage) so the owner traps it now — counsel’s belt and suspenders. The retainage pane says whether a recorded notice already did, and that on a retainage-only notice the owner may withhold only once they receive a copy of the filed affidavit.',
    'Cover letters now print the signing master’s own phone as the number to call, falling back to the letterhead’s only when he has none. Also fixed: the Affidavits tab had been re-rendering itself about a thousand times a second while open; it no longer does.',
  ],
}

export default note
