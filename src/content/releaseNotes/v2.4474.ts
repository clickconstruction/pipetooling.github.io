import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.4474',
  date: '2026-10-03',
  title: 'Paid-job email and sample agreement: the evening keeps its day',
  kind: 'fix',
  highlights: [
    'The paid-job email’s monthly table put a session, a card charge or a payment from the last evening of a month into the next month. It now uses the company’s month.',
    'The sample agreement under What customers see dated its wording by the day after an evening edit when the Contract Book gave no date. It now matches the Contract Book.',
  ],
}

export default note
