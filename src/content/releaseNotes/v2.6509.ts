import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.6509',
  date: '2026-11-04',
  title: 'The email viewer offers Start a bid and Put it on a bid',
  kind: 'feature',
  highlights: [
    'Open an email in a Messages thread and the row above its words reads the email. An invitation to bid, or any email tied to no job, offers Start a bid and Put it on a bid… beside Copy, Print or save as PDF and Share…',
    'Start a bid is the New lane’s Bid it? door: the bid’s name starts with what the email said, the customer is the sender’s or a new one the press makes, the link and the due day go on the bid, the email is tied to it and the Bid Board opens on it.',
    'Put it on a bid… picks one of your open bids by name or number, ties the email to it and writes one line on the bid’s history: Invitation to bid came in by email from Glenn Gelwin, Oct 22. So a bid found elsewhere says it reached you by email too.',
    'An email already on a bid offers Open the bid. Start a change order shows only on a message tied to a job, no longer on an invitation.',
  ],
  roles: ['dev', 'master_technician', 'assistant', 'controller', 'estimator'],
}

export default note
