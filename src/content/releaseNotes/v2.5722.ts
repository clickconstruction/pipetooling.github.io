import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.5722',
  date: '2026-10-21',
  title: 'Messages: a teammate’s email lands too',
  kind: 'feature',
  highlights: [
    'An email from someone on the team to bids@ or the team inbox now lands on their own thread, under the Our team pill, and shows in New or Needs a reply like their texts. Before, the reader left every staff address in Gmail.',
    'A teammate who emails a customer and copies the inbox puts that email on the customer’s thread as ours, with their name. The office sees what the field wrote without asking.',
    'Only mail the inbox sent itself, or the app sent, stays out as ours. Newsletters, notices and no-reply senders stay out as before.',
  ],
}

export default note
