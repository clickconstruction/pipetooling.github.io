import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.3789',
  date: '2026-09-24',
  title: 'Counsel’s lien grid, live on the law firm’s portal',
  kind: 'feature',
  highlights: [
    'The firm’s portal gains a third panel beside Matters and Notifications: the Lien grid — every billed job with money open and a lien month, one row each in counsel’s twelve columns (owner of record, kind and homestead, last on site, unpaid months and dollars, the § 53.056 date per month, the affidavit date, bond, paid out, 10 % reserved, contract completed), filtered per GC and by Something due / All, with Print the grid.',
    'It is the office’s own Timeline book, read live: the same rows the Lien desk reads, folded by the same kernel, so the printout the office used to email is now the page counsel opens. A red ? marks a fact the office has not entered yet.',
    'One migration lets the portal function read the desk’s two lien lists as the service role; nothing is typed on the portal and nothing new is stored.',
  ],
}

export default note
