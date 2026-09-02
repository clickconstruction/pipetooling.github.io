import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.2621',
  date: '2026-09-02',
  title: 'Signed lien releases come back to your inbox — and out to the customer',
  kind: 'feature',
  highlights: [
    'The Teams Inbox (Dashboard and Checklist → Review) gains two lien lanes: "Awaiting your signature" — the master signs right from the row — and "Signed — ready to send" for whoever requested it.',
    'From the ready-to-send lane: "Email to customer — PDF attached" sends the signed release in one confirm-first click, Download PDF grabs it for your own email, and "Mark sent without emailing" covers hand-delivered copies.',
    'Sending stamps the release sent ✓ on the job — the activity feed, Documents, and the release window all show the finished lifecycle: requested → signed → sent.',
  ],
}

export default note
