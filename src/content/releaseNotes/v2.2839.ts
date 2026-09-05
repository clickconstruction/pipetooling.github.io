import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.2839',
  date: '2026-09-05',
  title: 'Customer portal: the statement shows every open bill',
  kind: 'fix',
  highlights: [
    'A customer\'s portal statement now lists every bill they owe — including progress bills and change orders on jobs still in progress. Before, only bills on jobs already marked Billed appeared, so a customer with work under way could see about half of their real balance.',
    'The portal now uses the same "open bill" rule as the GC statement email: a billed, unpaid invoice is owed whatever stage the job is in. Balance due on the portal matches the office\'s Who owes figure.',
    'Jobs in progress with nothing billed yet still show nothing — the statement never invents a bill from a job\'s price.',
  ],
}

export default note
