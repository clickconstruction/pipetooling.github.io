import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.4885',
  date: '2026-10-07',
  title: 'AIA G702-G703: put the amounts back as they went out',
  kind: 'feature',
  highlights: [
    'An open pay application that changed after its workbook went out now says so in the form, naming each amount that moved.',
    'Put the amounts back sets the lines, the retainage percent and previous certificates back to what the GC has. Press Save to keep them.',
  ],
}

export default note
