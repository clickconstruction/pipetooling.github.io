import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.7793',
  date: '2026-11-18',
  title: 'Lien desk: one rule for a window that has closed, and the answers to it',
  kind: 'feature',
  roles: ['dev', 'master_technician', 'assistant', 'controller'],
  highlights: [
    'The app now tells two closed windows apart. One is a month whose notice day passed with no notice, where a late notice can still save the lien. The other is a job whose lien day passed with nothing filed.',
    'A lien affidavit past its day counts as closed whatever stage it stood in. Until now an approved one stayed in Ready to file.',
    'Each kind has its answers. A closed month: send a late notice, set the right last day of work, or record the month closed. A passed lien day: set the right last day of work, keep collecting, or mark the job Uncollectible.',
    'Nothing shows on a screen yet. The Board’s closed end and the window that asks follow in their own updates.',
  ],
}

export default note
