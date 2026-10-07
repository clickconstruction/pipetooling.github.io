import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.4467',
  date: '2026-10-02',
  title: 'Bills: a bill sent in the evening keeps its day on the job and in Documents',
  kind: 'fix',
  highlights: [
    'In a job’s Bill tab, a bill sent or marked billed after 7 pm Central showed the next day. It showed in the Invoices list, on a payment’s bill picker and on the Stripe panel, and Documents did the same.',
    'A payment taken the same day as an evening bill was flagged as paid before the bill went out. It no longer is.',
    'The Job Summary’s Cycle view counted bill days from that next day too. They all now read the day on the company’s calendar.',
  ],
}

export default note
