import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.6750',
  date: '2026-11-08',
  title: 'Quickfill: the Jobs Billing station folds into Complete, no Total Bill',
  kind: 'feature',
  roles: ['dev', 'master_technician', 'assistant', 'controller'],
  highlights: [
    'Complete, no Total Bill now lists every finished job whose bill is not filled in, and each row wears a chip for what it lacks: no Total Bill, no Specific Work, no Other job charges.',
    'The Jobs Billing station, hidden since April, is retired. Its three checks live on the finished jobs here, its old marks read under this station’s history, and its link lands here.',
    'The station asks one question for the three fields, the rows with no Total Bill come first, and a Jobs Billing tab link opens the tab where the fields are typed.',
  ],
}

export default note
