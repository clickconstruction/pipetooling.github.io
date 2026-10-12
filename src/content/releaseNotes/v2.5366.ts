import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.5366',
  date: '2026-10-12',
  title: 'Lien desk: a notice the leader signed with a pen has a record (pen train, PR 1)',
  kind: 'feature',
  roles: ['dev', 'master_technician', 'assistant', 'controller'],
  highlights: [
    'A lien notice can now be signed a third way: on the paper as printed, with a pen, written down by the office. The record names who signed, when, who wrote it down, and how they know.',
    'The frame on a reprinted copy reads Signed by pen, with the leader’s name in plain type and the sentence that says who recorded it. It never pretends to be ink.',
    'The leader can later confirm a pen signature from his own sign-in. Nothing waits on that; it strengthens the record.',
    'This is the kernel and the database rule. The door on the run and the notice footer comes in the next release.',
  ],
}

export default note
