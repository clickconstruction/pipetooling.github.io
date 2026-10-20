import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.5685',
  date: '2026-10-20',
  title: 'Cover Letter: print every GC’s copy at once',
  kind: 'feature',
  roles: ['estimator', 'dev', 'master_technician', 'assistant', 'controller'],
  highlights: [
    'When the bid goes to builders on Also sent to, a second print button makes one addressed copy per GC with a page break between them. Its label counts the copies — Print 3 letters.',
    'Each copy is the letter as mailed: no heading above it, only the name and address differ between copies.',
    'A builder with no address on file still prints, name line alone, and their chip says no address on file — one missing address never holds the batch.',
  ],
}

export default note
