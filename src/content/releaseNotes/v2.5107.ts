import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.5107',
  date: '2026-10-09',
  title: 'Job Parts Tally: undo a sort on the team’s card charges',
  kind: 'feature',
  roles: ['dev', 'master_technician', 'assistant', 'controller'],
  highlights: [
    'After Sort the day, the message that says the day is sorted has an Undo. It puts those charges back to sort.',
    'A charge already sorted shows under its card with Undo beside it. In Sorted under Team, Undo shows on each charge that went to a job.',
    'Undo is only on charges that went to a job. A charge matched to invoices keeps its Invoices button.',
  ],
}

export default note
