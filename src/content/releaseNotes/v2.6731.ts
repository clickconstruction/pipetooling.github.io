import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.6731',
  date: '2026-11-08',
  title: 'An answer sent from the bids or team inbox itself lands on the thread',
  kind: 'feature',
  highlights: [
    'Answer a customer from bids@ or the team inbox in Apple Mail or Gmail, and within a minute the email lands on their thread as ours, under the name the inbox signs with. Their move becomes the next one, and Went out lists it. Before, the app read only what came in, so a thread you had already answered still read Our move.',
    'An email the inbox sends only to a teammate stays in Gmail. An email the app sent from the inbox is already on the thread and is not written twice.',
    'The grey line in the reply box now says so: answer from the inbox in Apple Mail, or copy it, and the thread hears it.',
  ],
}

export default note
