import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.2859',
  date: '2026-09-05',
  title: '"Open the job" on every Won moment — the bid shows its job',
  kind: 'feature',
  highlights: [
    'Wherever you record a win — the Win/Loss row in Edit Bid, a GC pill on the Bid Board, the Sent to — by GC panel in Followup, or the one-tap Won in Waiting to hear — an "Open the job" button is right there. It opens New Job with the customer, address, plans and folder filled in and the bid linked, the same as Import.',
    'Edit Bid has a Job block beside Win/Loss: once a job exists it reads "J1007 opened from this bid" and opens it; you can still create another. The Copy Bid popover behind the trade pill is about copying bids again — the job door no longer hides at its bottom.',
    'Opening a second job from the same bid asks first ("A job already exists from this bid"), and cancelling the "Which GC gave you this job?" picker no longer strands a blank New Job form — it says the import was cancelled and closes the form it opened.',
    'Superintendents keep their read-only board; estimators get the button even without the Jobs page.',
  ],
}

export default note
