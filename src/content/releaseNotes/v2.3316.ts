import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.3316',
  date: '2026-09-11',
  title: 'PASS test reports can send themselves',
  kind: 'feature',
  highlights: [
    'Settings → Jobs & billing → Test reports gains a Sending switch. Off (the default): a person sends every report, as today. On: a hydrostatic PASS the tech filed goes to the GC on its own fifteen minutes later — the PDF, the Stripe pay link, the standing cc — and the job\'s activity reads "Sent automatically".',
    'It only fires when everything is in place: a PASS verdict, a Stripe bill on the job, a GC with an email on file. FAIL results, pinpoint and gas tests, and anything missing a bill or a GC email keep waiting on the Dashboard for a person.',
    'The fifteen-minute grace period is the office\'s window to open the draft first; anything opened and sent by hand is never sent twice.',
  ],
}

export default note
