import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.2886',
  date: '2026-09-05',
  title: 'A bid room starts with "Get the link" — no forced email',
  kind: 'fix',
  highlights: [
    'Bids → Cover Letter: the bid room panel\'s first button is now ✍ Get the link — it mints the GC\'s signable link and copies it for you without emailing anyone. Paste it into your own email, a text, or the GC\'s portal.',
    'Send to GC is the optional second action beside the email box; it still publishes on the way and stamps the packet sent on the first send from the app.',
    'Copy link and Open ↗ appear the moment a room is published, not after the first send. Open ↗ is your own view and never counts as the GC opening the room.',
    'After publishing, the blue button reads Publish update; emailing again is its own button — nothing goes out unless you press it.',
  ],
}

export default note
