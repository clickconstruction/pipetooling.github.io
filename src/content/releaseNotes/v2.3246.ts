import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.3246',
  date: '2026-09-10',
  title: 'Customer Waiting, part 1: portal requests arrive high priority',
  kind: 'feature',
  highlights: [
    'A request a customer sends from their portal — a visit, a bid, or a GC asking for other dates — now lands in the inbox marked high priority, with the number to call them at attached. The typed number wins; otherwise the number on file rides along.',
    'Bid requests now go to the Estimator inbox when that group has anyone in it (they used to sit in Dispatch, where the estimator never saw them). If the group is empty they still go to Dispatch.',
    'Portal requests never triggered a push notification before — the fan-out was refused every time. They do now.',
    'Parts 2–4 bring the red inbox row with tap-to-call, the banner that follows the team, lower/raise priority, and the portal form that pre-fills your number.',
  ],
}

export default note
