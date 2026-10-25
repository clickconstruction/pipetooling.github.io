import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.5857',
  date: '2026-10-25',
  title: 'The Bridge: the cash forecast expects a GC’s money at the GC pace',
  kind: 'fix',
  roles: ['dev'],
  highlights: [
    'The receipts band under the cash chart expected every first-job payer’s money at the company’s 7-day median, so a GC’s pay application read as money due next week and then as late. Each receipt now lands on the day the Collect desk reads for its bill: the payer’s own pace, the GC pace here for a GC, their segment’s pace for anyone else, the company’s last of all.',
    'The words beside each receipt say which: pays in ~35d, the GC pace here ~30d, commercial pace ~12d, company pace ~7d, promised.',
  ],
}

export default note
