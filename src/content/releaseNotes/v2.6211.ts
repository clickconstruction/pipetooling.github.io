import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.6211',
  date: '2026-10-31',
  title: 'Print a sworn statement: the whole paper, the statement alone or the signing page alone (punch list #220, PR 4 of six)',
  kind: 'feature',
  highlights: [
    'Press Print in the statement’s window, or on its row on the Timeline or the Evidence tab. A changed draft saves first, then the paper draws as it prints, and Print opens your print sheet on any device. Save as PDF makes the file to text or AirDrop.',
    'The ▾ beside Print offers three faces: the whole paper with the jurat, the statement alone to read over together, or the signing page alone to staple on a witness’s handwritten statement.',
    'A declaration with no notary asks for the declarant’s name, date of birth and address when you print. They go on the paper, stay for this session, and are never saved.',
    'Each print is noted on the row: when, by whom, which face. The firm reads the count beside the draft.',
  ],
  roles: ['dev', 'master_technician', 'assistant', 'controller'],
}

export default note
