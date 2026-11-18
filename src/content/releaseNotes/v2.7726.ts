import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.7726',
  date: '2026-11-18',
  title: 'Papers before a job opens: each paper a job requires shows on Documents → Agreements with its job',
  kind: 'feature',
  roles: ['dev', 'master_technician', 'assistant', 'controller'],
  highlights: [
    'A paper a job requires is now a line on Documents → Agreements once it goes out to sign, with the job beside it.',
    'The line shows the paper’s own name, such as Site rules, and who it is with.',
    'Type a job’s number in the find box to see every paper signed for that job.',
  ],
}

export default note
