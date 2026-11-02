import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.6349',
  date: '2026-11-02',
  title: 'Stage checklists: a tap on a stage’s name holds while the section finishes loading',
  kind: 'fix',
  highlights: [
    'On a job’s Documents tab, a tap on a stage’s name in Stage checklists folds that stage or opens it. A tap that landed just as the section finished its first read could be undone a moment later, and the stage sprang back. The tap now always holds.',
    'A ready stage still folds to one line on a phone when the section first opens, unless you already tapped it.',
  ],
  roles: ['dev', 'master_technician', 'assistant', 'controller', 'superintendent'],
}

export default note
