import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.2008',
  date: '2026-08-21',
  kind: 'feature',
  title: 'Customer portal: one merged statement + custom addresses (backend)',
  highlights: [
    "A customer's portal can now show one merged statement — their own jobs beside the properties they GC, with an AS GC tag naming whose property each one is.",
    'Portals can live at a short custom address (like /p/knight-contracting) that survives link rotation — the long token link keeps working as a direct fallback.',
    'The custom address stays editable until it is first shared, then locks; changing it after that is deliberate and warned.',
  ],
}

export default note
