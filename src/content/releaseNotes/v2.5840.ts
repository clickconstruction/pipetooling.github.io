import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.5840',
  date: '2026-10-25',
  title: 'Legal desk: catch a sub job set up as if we worked for the owner',
  kind: 'feature',
  roles: ['dev', 'master_technician', 'assistant', 'controller'],
  highlights: [
    'Before this goes to an attorney gains “Probably a subcontract on 891” when a job has no GC, its owner of record is another company, and the customer looks like a GC (commercial, pays as a GC by default, or the GC on another job). Set up that way the desk tracked no monthly lien notice and the job form hid the retainage box.',
    'Set the GC moves the customer into the GC slot in one press; the customer slot clears, the bills go to the GC and the notices are tracked from there. Ours with the owner keeps the job as it is and puts the note away for good.',
    'A homeowner whose house is held by a trust or an LLC is not flagged: the name alone is never enough.',
  ],
}

export default note
