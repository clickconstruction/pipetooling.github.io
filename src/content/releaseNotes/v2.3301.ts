import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.3301',
  date: '2026-09-11',
  title: 'Send the test report to the GC from the job',
  kind: 'feature',
  highlights: [
    'The Test report modal gains Send to GC: To is the job\'s GC (else the customer), the standing cc comes from Settings, the subject and message are the ones the office typed by hand until now — "Attached is the report for … and below is the invoice link" — with the job\'s Stripe pay link filled in. One click sends the PDF and the link together.',
    'No Stripe bill on the job yet? The sheet says Bill first, and Send without the link stays a deliberate second choice.',
    'Every send is kept: the exact PDF that went out (a new version each time, the old one never overwritten), who it went to, whether the link rode along, who certified — and a line on the job\'s activity. Sent reports read "Sent Sep 11 to …" in the modal.',
    'The Dashboard\'s Needs You list adds "N test reports ready to send" for the office; the card opens the first one.',
  ],
}

export default note
