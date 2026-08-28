import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.2439',
  date: '2026-08-28',
  title: 'One twin key, both apps',
  kind: 'feature',
  highlights: [
    'A digital twin’s MCP connection can now sign into CountTooling too — mint_session takes the app to enter, so an estimator twin moves between takeoff and bidding with a single credential.',
    'Partners still hold exactly one token per twin; CountTooling’s secret stays server-side.',
  ],
}

export default note
