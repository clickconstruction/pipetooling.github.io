import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.5989',
  date: '2026-10-27',
  title: 'The GC’s account page opens a notarized lien waiver',
  kind: 'fix',
  roles: ['assistant', 'controller', 'master_technician', 'dev'],
  highlights: [
    'A lien waiver signed before a notary now opens its PDF on the GC’s account page, from the bill’s note and from Your papers. It is the notarized PDF the office attached, the same file the email to the GC carried.',
    'Before, the page listed such a waiver as signed with nothing to open. A waiver filed by its Google Drive link alone still shows there without a PDF.',
  ],
}

export default note
