import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.3942',
  date: '2026-09-27',
  title: 'GC Review: print every unpaid invoice for a GC',
  kind: 'feature',
  highlights: [
    'Each GC’s Share menu in GC Review has a new item, Print unpaid invoices. It opens every unpaid invoice on that GC’s statement as one PDF in a new tab, in the statement’s order, ready to print or save.',
    'Each job is re-read as the PDF builds, so a bill paid since you opened GC Review is left out; a part-paid bill prints with its payments and balance due.',
    'A message says how many invoices printed and names anything left out — for example a job balance that has no bill behind it.',
  ],
}

export default note
