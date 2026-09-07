import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.3061',
  date: '2026-09-07',
  title: 'Dates no longer depend on a locale quirk',
  kind: 'fix',
  highlights: [
    'A hundred-plus places that built a YYYY-MM-DD date from the browser’s Canadian-English formatting now use the app’s own date helpers. Nothing changes on screen; it removes a way dates could silently come out as MM/DD/YYYY on some runtimes.',
    'A build check now stops the old pattern from coming back.',
  ],
}

export default note
