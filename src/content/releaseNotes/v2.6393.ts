import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.6393',
  date: '2026-11-02',
  title: 'Where files go: the People folder, and a person’s evidence filed into Drive',
  kind: 'feature',
  highlights: [
    'Documents → Where files go has a fifth card, the People folder. Paste a Drive folder link, press Check, then Use this folder. A person’s evidence lands under it, a folder per person, a folder per piece named by the day and the title.',
    'Give it a Shared Drive of its own. The save refuses a folder that sits in the Jobs drive, whose members would read the evidence there.',
    'Evidence kept on a person’s file is filed into that folder as it is kept, and a sweep every ten minutes catches anything Drive refused. The file’s record shows In Drive, on its way, or the reason it is not, with Try Drive again.',
  ],
  roles: ['dev', 'master_technician', 'assistant', 'controller'],
}

export default note
