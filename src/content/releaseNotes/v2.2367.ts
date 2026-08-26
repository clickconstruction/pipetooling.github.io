import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.2367',
  date: '2026-08-26',
  title: 'Pricing shows "loading" instead of pretending your version is gone',
  kind: 'fix',
  highlights: [
    'Jumping to Pricing (the board\'s price-tag icon, or switching bids) briefly showed the "The Workbench needs Counts…" setup message and a "one packet" Send-to strip while your packets were still loading — which read as deleted work. Both now show a calm loading shimmer until the data actually arrives.',
    'If the load fails (bad connection), Pricing now says so and offers Retry — with a reminder that your versions are safe. Before, a failed load silently stuck on the empty setup message until you reloaded the page.',
  ],
}

export default note
