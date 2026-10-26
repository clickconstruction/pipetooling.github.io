import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.5893',
  date: '2026-10-26',
  title: 'The Lien Release tab speaks the statutory forms',
  kind: 'feature',
  roles: ['estimator', 'assistant', 'controller', 'master_technician', 'dev'],
  highlights: [
    'Bids → Lien Release now makes the same four Texas § 53.284 waiver forms as the job\'s Release of Lien window: conditional or unconditional, on a progress or a final payment. The old homemade invoice-wrapper document is retired.',
    'Two switches pick the form, with the statute line and one line of why under them. Choosing Unconditional asks the window\'s own warning first, and Stay conditional is the safe blue answer.',
    'The boxes fill from the bid — the GC as payor, the bid\'s number as the amount — and the paper beside them redraws as you type. Copy for email, Print and Download PDF send it out.',
    'An unconditional waiver gives up rights, so its outputs hold for everyone but the leaders and the controller. Estimators draft it; an amber note says whose signature it waits on.',
  ],
}

export default note
