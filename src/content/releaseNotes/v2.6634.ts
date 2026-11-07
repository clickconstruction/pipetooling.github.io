import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.6634',
  date: '2026-11-07',
  title: 'A signed hours statement goes into the job’s Drive folder with one press',
  kind: 'feature',
  roles: ['dev', 'controller'],
  highlights: [
    'A signed row under Hours statements carries Put in Sent by us. One press copies the signed PDF into the job’s Drive folder, under Team only and then Sent by us.',
    'Once it is there the row reads Open in Drive, which opens the copy. The press is offered once per statement.',
    'The Legal desk’s Add to evidence is unchanged and separate: the matter’s copy is for the firm, the Drive copy is the office’s own.',
  ],
}

export default note
