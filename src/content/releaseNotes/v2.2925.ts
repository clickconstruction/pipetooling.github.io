import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.2925',
  date: '2026-09-06',
  title: 'Help guides for bids, imports, estimates, purchase orders and quote links now read the way the app works',
  kind: 'fix',
  highlights: [
    'Bid Board and Followup: the guides now say that section counts follow the trade pill (the Dashboard counts the whole company), that sent bids go colour-quiet on purpose and the chase lives in Followup → Call queue, that the "sent 1/2" badge counts packets (same-letter GCs are not packets), and what the Won confirm and "waiting" undo do on every one-tap.',
    'Three new guides: "choose By Stage or Combined for a bid\'s materials" (count each fixture vs one parts list, and what switching keeps), "send an estimate and turn it into a job" (new → send → opened or not → resend → no thanks or signed → job, in one place), and "raise a purchase order" (PO Generator code vs the PO Builder → Purchase Orders lane, the three prices a part can show, Price coverage and the duplicates page).',
    'Estimator start-here now covers Get the link on the bid room, Open the job on a win, the read-only job pane, and where change orders come from; the change-order guide is visible to estimators, devs and controllers, who can all write one.',
    'CountTooling import points at the By Stage / Combined choice; the quote-link guide notes that pasted vendor replies match names across slashes and plurals.',
  ],
}

export default note
