import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.6904',
  date: '2026-11-10',
  title: 'A scanned box stays open when the app reloads',
  kind: 'fix',
  highlights: [
    'Scan a box label while signed in and the box opens on the Tally. When the app then reloaded itself to pick up a new version, it came back to the list of boxes. It now comes back to the box you scanned.',
    'The same holds when you refresh the page yourself, and when you go to another page and press Back.',
    'The address of the Tally names the box while it is open, so a copied link opens that box. Leave the box and the address is the plain On site tab again.',
    'After a scan, choosing another job now opens that job’s boxes. It used to say the scanned box was not on the job any more.',
  ],
}

export default note
