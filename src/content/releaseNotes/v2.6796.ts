import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.6796',
  date: '2026-11-09',
  title: 'Materials on site: a scanned label opens the box for the crew, and the code reads with a dash',
  kind: 'fix',
  highlights: [
    'Scanning the QR on a cage or box label now opens that box on the On site tab for helpers, subcontractors, primaries and superintendents. Before this the app sent them to the Dashboard and only the office could land on the box.',
    'The code under the QR on the sheet label and the manifest reads like 4F2A-9C18, four characters and a dash and four more, so it can be read out over the phone. Typed with or without the dash it opens the same box, and the QR itself is unchanged.',
  ],
}

export default note
