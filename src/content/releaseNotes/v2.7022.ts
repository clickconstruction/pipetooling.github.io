import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.7022',
  date: '2026-11-12',
  title: 'Messages: a developer can take back a conversation they tagged onto the wrong job',
  kind: 'feature',
  highlights: [
    'A developer can tag an email conversation from a teammate’s mail onto a job. Until now only the teammate could take it back off, in Messages → My email.',
    'The developer can now take it off too, but only a conversation the developer’s own tag put there. A conversation you tagged yourself stays yours to untag.',
    'The untag is planned first and changes nothing until it is approved. The plan lists what goes, what the office is still holding, and what a legal matter keeps.',
    'It also clears what the tag left around the lines: the person on the job’s people, and a contact the tag made for a sender nobody knew. The mail itself stays in Gmail.',
  ],
}

export default note
