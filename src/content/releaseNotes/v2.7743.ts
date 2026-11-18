import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.7743',
  date: '2026-11-18',
  title: 'Lien receipts: a wrong receipt taken off goes to Drive’s trash, and you can put it back',
  kind: 'feature',
  highlights: [
    'Take off on a saved mail receipt used to leave the wrong file in the job’s Drive folder. It now moves the file to Drive’s trash, where Drive keeps it 30 days.',
    'A line under the press says where the file is now. Put it back brings the file out of the trash and onto the paper again.',
    'Replace sends the old file to the trash once the new one is saved.',
    'It works wherever a receipt is added: the run, Filed liens: copies to mail, What went out, and Record service in the Lien window. When Drive is busy the take-off still stands, and Try again sends the file again.',
  ],
}

export default note
