import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.6969',
  date: '2026-11-11',
  title: 'An HR file can record which entry corrects which',
  kind: 'feature',
  highlights: [
    'A correction on an HR file is still a new entry. It can now name the entry or the piece of evidence it corrects, or the one it adds to, so the two are joined by more than words.',
    'Nothing already on a file changes. Entries and evidence stay as they were written, and a correction written earlier can be joined to what it corrects later.',
    'A link made by mistake is withdrawn with a reason and stays on the record. It is never deleted.',
    'This is the groundwork. The Timeline starts showing an entry as corrected in a later release.',
  ],
}

export default note
