import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.6034',
  date: '2026-10-28',
  title: 'Billed: a new GC’s bill is expected at the GC pace, a new customer’s at its segment’s',
  kind: 'feature',
  highlights: [
    'The expected pay date on every billed row, the payment forecast, call mode and the dates block now read a payer with no payment history the way the Collect desk does: a GC at the GC pace here, the middle pace of the GCs who have paid us; anyone else at their segment’s pace, residential or commercial; the company-wide median only when neither is on record. Structura’s $103k pay application reads 35 days at the GC pace, not 7 at the company’s.',
    'A payer reads as a GC by its record, by a pay application on the job, or by a commercial payer’s bill marked billed by hand. The chip and its hover say which pace they read and over how many payments or payers: pays in ~35d, the GC pace ~35d over 3 payers, commercial pace ~12d, company avg.',
    'The Collect desk and the chips share one rule now, so the pile and the forecast read the same bill the same way. The Job window’s bills list and the Follow-up flow read a new GC at its segment’s pace, since they have no pile to rest the GC pace on.',
  ],
}

export default note
