import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.4190',
  date: '2026-09-29',
  title: 'A texted help-guide link shows the guide, not a bare domain',
  kind: 'fix',
  highlights: [
    'A clicktooling.com/g/… share link texted from an iPhone showed only “clicktooling.com”: Messages runs the page like a browser, and the page bounced it into the app’s sign-in before it could read the card. The share page is now a small landing page — the guide’s question, its first line, an Open in ClickTooling button — that opens the app a moment later for a person and never for a link preview.',
    'Every guide now has its own share card: the app’s dark card with the guide’s question written on it, so the picture in Messages, WhatsApp or Slack says what the link is.',
  ],
}

export default note
