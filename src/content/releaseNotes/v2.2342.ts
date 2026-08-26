import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.2342',
  date: '2026-08-26',
  title: 'Settings gets a Usage dashboard (dev)',
  kind: 'feature',
  highlights: [
    'A new Settings → Usage tab (dev only) shows how the company actually uses the app: where the time goes by page, which navigation controls get clicked, whether customers open the statements and estimates we send, and which pages sit quiet.',
    'A People view breaks the same time data down by role, then by person — open anyone to see their top pages.',
    'Range chips switch between the last 7, 30, and 60 days.',
  ],
}

export default note
